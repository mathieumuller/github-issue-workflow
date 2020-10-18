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

    // an issue has to be associated to the project card to continue
    let issue = await getIssue();
    if (issue == undefined) {
        cancel('You must associate an issue to the project card!');
    }

    if (issue.milestone == undefined) {
        cancel('You must associate a milestone to the issue of the project card!');
    }
    
    let labels = await getLabels()
        issueType = labels.type;

    // if label type is not provided -> cancel the action
    if (issueType == undefined) {
        cancel('You must provide the Type:xxx label');
    }

    let milestoneTitle = issue.milestone.title,
        branchName = [issueType.substring(typeLabelPrefix.length), tools.stringToSlug(issue.title)].join('/'),
        pullRequestName = issue.title,
        releaseBranchName = "release/"+milestoneTitle;

    // get or create the pull request branch
    await getOrCreateBranch(releaseBranchName, branchName);
    // create a new entr in the changelog file
    await updateChangeLog(milestoneTitle, issue, branchName, releaseBranchName);

    // creates the draft pull request
    let { data: pullRequest } = await octokit.pulls.create({
        owner: repositoryOwner,
        repo: repositoryName,
        title: pullRequestName,
        head: branchName,
        base: releaseBranchName,
        draft: 'yes'
    });


    // as the pull request is created by the github bot, we set the author into a comment
    // as it's impossible to link an issue through github api, we add a link into a comment
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

/**
 * Get the branch corresponding to the issue name or create it
 * @param {string} releaseBranchName 
 * @param {string} branchName 
 */
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

/**
 * Update the changelog file to be able to create an empty pull request for the created branch
 * @param {string} milestoneTitle 
 * @param {object} issue 
 * @param {string} branchName 
 * @param {string} releaseBranchName 
 */
async function updateChangeLog(milestoneTitle, issue, branchName, releaseBranchName)
{
    // Get the current content of the file on the target branch
    let path="changelog.md",
        {data: file} = await octokit.repos.getContent({
            owner: repositoryOwner,
            repo: repositoryName,
            path: path,
            ref: "refs/heads/"+releaseBranchName
        }),
        // convert the content into json
        changelogJSON = await getMarkdownToJSONContent(file.content),
        // create the new entry to add to the changelog
        changelogRaw = getChangelogRaw(issue)
    ;

    // Add the new content at the appropriate position (depending on the issue milestone)
    if (changelogJSON[milestoneTitle] !== undefined) {
        changelogJSON[milestoneTitle].raw += changelogRaw;
    } else {
        changelogJSON[milestoneTitle] = {raw: changelogRaw};
    }
    
    // push the commit to the given branch 
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

/**
 * Get a branch by its name
 * @param {string} name 
 */
async function getBranch(name) {
    let { data: branch } = await octokit.repos.getBranch({
        owner: repositoryOwner,
        repo: repositoryName,
        branch: name,
    });

    return branch;
}

/**
 * Get the issueof the project card
 */
async function getIssue()
 {
    let { data: issue } = await octokit.issues.get({
        owner: repositoryOwner,
        repo: repositoryName,
        issue_number: issueNumber,
      });

      return issue;
 }

/**
 * Get the issue labels (type + expert) as an associative array
 */
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

/**
 * Retrieve the column name by its id
 */
async function getColumnName() {
    let columnId = projectCard.column_id;
    
    let { data: column } = await octokit.projects.getColumn({
      column_id: columnId,
    });

    return column.name;
}

/**
 * Decode the github content and parse it into a json object
 * @param {string} content 
 */
async function getMarkdownToJSONContent(content)
{
    return md2json.parse(tools.base64Decode(content));
}

/**
 * Build the content to add to the changelog 
 * @param {object} issue 
 */
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

/**
 * Add many labels to an issue
 * @param {array} labels 
 * @param {integer} number 
 */
function addLabels(labels, number) {
    octokit.issues.addLabels({
        owner: repositoryOwner,
        repo: repositoryName,
        issue_number: number,
        labels: labels
    });
}

/**
 * Cancel the current action and move the project card back to its original column
 * @param {string} message 
 */
function cancel(message)
{
    octokit.projects.moveCard({
        card_id: projectCard.id,
        position: "top",
        column_id: payload.changes.column_id.from,
      });
    throw new Error(message);
}

/**
 * Assigne many collaborators to the given issue
 * @param {array} assignees 
 * @param {integer} number 
 */
function assign(assignees, number) {
    octokit.issues.addAssignees({
        owner: repositoryOwner,
        repo: repositoryName,
        issue_number: number,
        assignees: assignees,
    });
}

