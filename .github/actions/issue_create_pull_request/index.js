const core = require('@actions/core'),
    github = require('@actions/github'),
    token = core.getInput('token'),
    context = github.context,
    octokit = github.getOctokit(token),
    payload = context.payload,
    repository = process.env.GITHUB_REPOSITORY,
    repositoryOwner = repository.split('/')[0],
    repositoryName = repository.split('/')[1],
    typeLabelPrefix = core.getInput('typeLabelPrefix'),
    expertLabelPrefix = core.getInput('expertLabelPrefix'),
    labelToListen = core.getInput('labelToListen'),
    projectCard = payload.project_card,
    issueNumber = basename(projectCard.content_url);

let changelog = require("../../../changelog.json");

try {
    createPullRequest();
} catch (error) {
    core.setFailed(error.message);
}

async function createPullRequest() {
    // only create the pull request when the issue has "in progress" label
    if (!hasLabel(labelToListen)) {
        return;
    }
    
    let issue = await getIssue(),
        labels = await getLabels(),
        milestone = issue.milestone.title,
        branchName = [labels.type, milestone, stringToSlug(issue.title)].join('/'),
        pullRequestName = issue.title,
        originBranchName = "release/"+milestone;

    // get or create the pull request branch
    await getOrCreateBranch(originBranchName, branchName);
    // create a new entr in the changelog file
    await updateChangeLog(milestone, issue.title, branchName);

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
        base: originBranchName,
        draft: 'yes'
      });
}

async function getOrCreateBranch(originBranchName,  branchName) 
{
    let targetBranch = null;

    try {
        targetBranch = await getBranch(branchName);
    } catch (error) {
        // catch error if the branch does not exists
    }

    // don't recreate an existing branch
    if (targetBranch === null) {
        let originBranch = await getBranch(originBranchName),
        originSha = originBranch.commit.sha;

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


async function updateChangeLog(milestone, issueTitle, branchName)
{
    let path="changelog.json",
        {data: file} = await octokit.repos.getContent({
            owner: repositoryOwner,
            repo: repositoryName,
            path: path,
        });

    if (changelog[milestone] !== undefined) {
        changelog[milestone].push(issueTitle);
    } else {
        changelog[milestone] = [issueTitle];
    }

    let response = await octokit.repos.createOrUpdateFileContents({
        owner: repositoryOwner,
        repo: repositoryName,
        path: path,
        message: "update changelog.json",
        // content has to be base64 encoded
        content: Buffer.from(JSON.stringify(changelog, null, 2)).toString('base64'),
        branch: branchName,
        sha: file.sha,
        committer: {
            name: payload.sender.name,
            email: payload.sender.email || 'mathieu.muller@uppler.com'
        },
        author: {
            name: payload.sender.name,
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

function basename(path) {
    return path.split('/').reverse()[0];
}

function stringToSlug (str) {
    str = str.replace(/^\s+|\s+$/g, ''); // trim
    str = str.toLowerCase();
  
    // remove accents, swap ñ for n, etc
    var from = "àáäâèéëêìíïîòóöôùúüûñç·/_,:;";
    var to   = "aaaaeeeeiiiioooouuuunc------";
    for (var i=0, l=from.length ; i<l ; i++) {
        str = str.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
    }

    str = str.replace(/[^a-z0-9 -]/g, '') // remove invalid chars
        .replace(/\s+/g, '-') // collapse whitespace and replace by -
        .replace(/-+/g, '-'); // collapse dashes

    return str;
}


