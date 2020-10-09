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

    let issue = await getIssue();
    console.log(issue);
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

function addLabel(label) {
    octokit.issues.addLabels({
        owner: repositoryOwner,
        repo: repositoryName,
        issue_number: issueNumber,
        labels: [label]
    });
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

async function removeStateLabels() {
    // get all the current labels of the issue
    let { data: currentLabels } = await octokit.issues.listLabelsOnIssue({
        owner: repositoryOwner,
        repo: repositoryName,
        issue_number: issueNumber
    });

    // and remove those with the 'State:' prefix
    currentLabels.forEach(function(currentLabel) {
        if (currentLabel.name.substring(0, stateLabelPrefix.length) === stateLabelPrefix) {
            removeLabel(currentLabel.name, issueNumber);
        }
    });
}

async function removeLabel(label) {
    octokit.issues.removeLabel({
        owner: repositoryOwner,
        repo: repositoryName,
        issue_number: issueNumber,
        name: label
    });
}

async function getColumn() {
    let columnId = projectCard.column_id;
    
    let { data: column } = await octokit.projects.getColumn({
      column_id: columnId,
    });

    return column;
}

function basename(path) {
    return path.split('/').reverse()[0];
 }
