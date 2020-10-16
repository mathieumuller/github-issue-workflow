const { base64Decode } = require("../tools.js");

const tools = require("../tools.js"),
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


// let changelog = require("../../../changelog.json");

try {
    createPullRequest();
} catch (error) {
    core.setFailed(error.message);
}

async function createPullRequest() {
    // only create the pull request when the issue has been moved into the "in progress" column
    // let columnName = await getColumnName();
    // if(columnName !== core.getInput('triggerColumn')) {
    //     return;
    // }
    
    let issue = await getIssue(),
        labels = await getLabels(),
        milestoneTitle = issue.milestone.title,
        branchName = [labels.type, tools.stringToSlug(issue.title)].join('/'),
        pullRequestName = issue.title,
        releaseBranchName = "release/"+milestoneTitle;

    // get or create the pull request branch
    // await getOrCreateBranch(releaseBranchName, branchName);
    // create a new entr in the changelog file
    await updateChangeLog(milestoneTitle, issue, branchName);

    // complete the pull request name with the tags
    if (labels.expert.length > 0)
    {
        pullRequestName = '[' + labels.expert + '] '+pullRequestName;
    }

    // creates the pull request
    octokit.pulls.create({
        owner: repositoryOwner,
        repo: repositoryName,
        title: pullRequestName,
        head: branchName,
        base: releaseBranchName,
        draft: 'yes'
      });
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


async function updateChangeLog(milestoneTitle, issue, branchName)
{
    console.log(issue);
    let changelogJSON = await getChangelogJSONContent(),
        changelogRaw = getChangelogRaw(issue)
    ;

    if (changelogJSON[milestoneTitle] !== undefined) {
        changelogJSON[milestoneTitle].raw += changelogRaw;
    } else {
        changelogJSON[milestoneTitle].raw = changelogRaw;
    }

    console.log(changelogJSON);
    return;
    
    let response = await octokit.repos.createOrUpdateFileContents({
        owner: repositoryOwner,
        repo: repositoryName,
        path: path,
        message: "update changelog.json",
        // content has to be base64 encoded
        content: Buffer.from(JSON.stringify(changelogJSON, null, 2)).toString('base64'),
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


async function hasLabel(label) {
    let { data: currentLabels } = await octokit.issues.listLabelsOnIssue({
        owner: repositoryOwner,
        repo: repositoryName,
        issue_number: issueNumber,
    });

    let labelExists = false;
    currentLabels.forEach(function(currentLabel) {
        if (currentLabel.name == label) {
            labelExists = true;
        }
    });

    return labelExists;
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
    list = {};

    // and remove those with the 'State:' prefix
    currentLabels.forEach(function(currentLabel) {
        if (currentLabel.name.substring(0, typeLabelPrefix.length) === typeLabelPrefix) {
            list = Object.assign(list, {'type': currentLabel.name.substring(typeLabelPrefix.length)});
        }
        if (currentLabel.name.substring(0, expertLabelPrefix.length) === expertLabelPrefix) {
            list = Object.assign(list, {'expert': currentLabel.name.substring(expertLabelPrefix.length)});
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

async function getChangelogJSONContent()
{
    let path="changelog.md",
        {data: file} = await octokit.repos.getContent({
            owner: repositoryOwner,
            repo: repositoryName,
            path: path,
        });

    return md2json.parse(base64Decode(file.content));
}

async function getChangelogRaw(issue)
{
    return "["
        + issue.title
        + "]("
        + issue.url  
        + ") ("
        + payload.sender.login
        + ")\n"
    ;
}

