const tools = require('../tools.js'),
    core = require('@actions/core'),    
    github = require('@actions/github'),
    md2json = require('md-2-json'),
    token = core.getInput('token'),
    context = github.context,
    octokit = github.getOctokit(token),
    payload = context.payload,
    repository = process.env.GITHUB_REPOSITORY,
    repositoryOwner = repository.split('/')[0],
    repositoryName = repository.split('/')[1],
    typeLabelPrefix = core.getInput('typeLabelPrefix'),
    expertLabelPrefix = core.getInput('expertLabelPrefix'),
    projectCard = payload.project_card,
    issueNumber = tools.basename(projectCard.content_url);

try {
    createPullRequest();
} catch (error) {
    core.setFailed(error.message);
}

async function createPullRequest() {
    // only create the pull request when the issue has been moved into the "in progress" column
    let columnName = await getColumnName();
    if(columnName !== core.getInput('triggerColumn')) {
        return;
    }
    
    let issue = await getIssue(),
        labels = await getLabels();

    if (labels.type == undefined) {
        cancel('You must provide the Type:xxx label');
    }

    let issueType = labels.type,
        milestoneTitle = issue.milestone.title,
        branchName = [issueType.substring(typeLabelPrefix.length), tools.stringToSlug(issue.title)].join('/'),
        pullRequestName = issue.title,
        releaseBranchName = "release/"+milestoneTitle;

    // get or create the pull request branch
    await getOrCreateBranch(releaseBranchName, branchName);
    // create a new entr in the changelog file
    await updateChangeLog(milestoneTitle, issue, branchName, releaseBranchName);


    // creates the pull request
    let { data: pullRequest } = await octokit.pulls.create({
        owner: repositoryOwner,
        repo: repositoryName,
        title: pullRequestName,
        head: branchName,
        base: releaseBranchName,
        draft: 'yes'
    });


    // as the pull request is created by the github bot, we set the author into a comment
    octokit.issues.createComment({
        owner: repositoryOwner,
        repo: repositoryName,
        issue_number: pullRequest.number,
        body: "author: @" + payload.sender.login + "\n" + "issue: " + "[#" + issueNumber + "](" + issue.html_url + ")",
    });

    // transfer the issue labels on the PR
    labels.expert.push(issueType);
    addLabels(labels.expert, pullRequest.number);

    // assign the author of the pull request
    assign([payload.sender.login], pullRequest.number);
}

async function getOrCreateBranch(releaseBranchName,  branchName) 
{
    let targetBranch = null;

    try {
        targetBranch = await getBranch(branchName);
    } catch (error) {
        // catch error if the branch does not exists
    }

    // don't recreate an existing branch
    if (targetBranch === null) {
        let releaseBranch = await getBranch(releaseBranchName),
        originSha = releaseBranch.commit.sha;

        let response = await octokit.git.createRef({
            owner: repositoryOwner,
            repo: repositoryName,
            ref: "refs/heads/"+branchName,
            sha: originSha,
        });

        targetBranch = response.object;
    
    }
    
    return targetBranch;
}


async function updateChangeLog(milestoneTitle, issue, branchName, releaseBranchName)
{
    let path="changelog.md",
        {data: file} = await octokit.repos.getContent({
            owner: repositoryOwner,
            repo: repositoryName,
            path: path,
            ref: "refs/heads/"+releaseBranchName
        }),
        changelogJSON = await getMarkdownToJSONContent(file.content),
        changelogRaw = getChangelogRaw(issue)
    ;

    if (changelogJSON[milestoneTitle] !== undefined) {
        changelogJSON[milestoneTitle].raw = changelogRaw + changelogJSON[milestoneTitle];
    } else {
        changelogJSON[milestoneTitle] = {raw: changelogRaw};
    }
    
    let response = await octokit.repos.createOrUpdateFileContents({
        owner: repositoryOwner,
        repo: repositoryName,
        path: path,
        message: "update changelog.json",
        // content has to be base64 encoded
        content: tools.base64Encode(md2json.toMd(changelogJSON)),
        branch: branchName,
        sha: file.sha,
        committer: {
            name: payload.sender.login,
            email: payload.sender.email || 'mathieu.muller@uppler.com'
        },
        author: {
            name: payload.sender.login,
            email: payload.sender.email || 'mathieu.muller@uppler.com'
        }
    });

    return response;
}

async function getBranch(name) {
    let { data: branch } = await octokit.repos.getBranch({
        owner: repositoryOwner,
        repo: repositoryName,
        branch: name,
    });

    return branch;
}

async function getIssue()
 {
    let { data: issue } = await octokit.issues.get({
        owner: repositoryOwner,
        repo: repositoryName,
        issue_number: issueNumber,
      });

      return issue;
 }

async function getLabels() {
    // get all the current labels of the issue
    let { data: currentLabels } = await octokit.issues.listLabelsOnIssue({
        owner: repositoryOwner,
        repo: repositoryName,
        issue_number: issueNumber
    }),
    list = {expert: []};

    // and remove those with the 'State:' prefix
    currentLabels.forEach(function(currentLabel) {
        if (currentLabel.name.substring(0, typeLabelPrefix.length) === typeLabelPrefix) {
            if(list.type == undefined) {
                list.type = currentLabel.name;
            } else {
                list.type.push(currentLabel.name);
            }
        }
        if (currentLabel.name.substring(0, expertLabelPrefix.length) === expertLabelPrefix) {
            list.expert.push(currentLabel.name);
        }
    });

    return list;
}

async function getColumnName() {
    let columnId = projectCard.column_id;
    
    let { data: column } = await octokit.projects.getColumn({
      column_id: columnId,
    });

    return column.name;
}

async function getMarkdownToJSONContent(content)
{
    return md2json.parse(tools.base64Decode(content));
}

function getChangelogRaw(issue)
{
    return "- ["
        + issue.title
        + "]("
        + issue.html_url  
        + ") (@"
        + payload.sender.login
        + ")\n"
    ;
}

function addLabels(labels, number) {
    octokit.issues.addLabels({
        owner: repositoryOwner,
        repo: repositoryName,
        issue_number: number,
        labels: labels
    });
}

function cancel(message)
{
    octokit.projects.moveCard({
        card_id: projectCard.id,
        position: payload.changes.column_id.from,
      });
    throw new Error(message);
}

function assign(assignees, number) {
    octokit.issues.addAssignees({
        owner: repositoryOwner,
        repo: repositoryName,
        issue_number: number,
        assignees: assignee,
    });
}

