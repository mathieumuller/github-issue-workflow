const core = require('@actions/core'),
    github = require('@actions/github'),
    token = core.getInput('token'),
    context = github.context,
    octokit = github.getOctokit(token),
    payload = context.payload,
    repository = process.env.GITHUB_REPOSITORY,
    repositoryOwner = repository.split('/')[0],
    repositoryName = repository.split('/')[1],
    stateLabelPrefix = core.getInput('stateLabelPrefix'),
    projectCard = payload.project_card,
    issueNumber = basename(projectCard.content_url),
    labels = {
        'To do': 'State:ToDo',
        'To plan': 'State:ToPlan',
        'In progress': 'State:InProgress',
        'To review': 'State:InReview'
    };

try {
    updateStateLabel();
} catch (error) {
    core.setFailed(error.message);
}

async function updateStateLabel() {
    console.log(payload);
    // remove all state labels of the issue
    removeStateLabels();
    // add the label corresponding to the column to the issue
    let { data: column } = await octokit.projects.getColumn({
        columnId,
    }),
    columnName = column.name;

    console.log(labels, columnName, labels[columnName]);
    addLabel(labels[columnName]);
}

function basename(path) {
    return path.split('/').reverse()[0];
}

function addLabel(label) {
    let lbs = [label];
    octokit.issues.addLabels({
        repositoryOwner,
        repositoryName,
        issueNumber,
        lbs,
    });
}

async function removeStateLabels() {
    // get all the current labels of the issue
    let { data: currentLabels } = await octokit.issues.listLabelsOnIssue({
        owner: repositoryOwner,
        repo: repositoryName,
        issue_number: issueNumber,
    });

    // and remove those with the 'State:' prefix
    currentLabels.forEach(function(currentLabel) {
        if (currentLabel.name.substring(0, 5) === stateLabelPrefix) {
            removeLabel(currentLabel.name);
        }
    });
}

async function removeLabel(label) {
    octokit.issues.removeLabel({
        owner: repositoryOwner,
        repo: repositoryName,
        issue_number: issueNumber,
        name: label,
    });
}

async function getColumnName(columnId) {
    let { data: column } = await octokit.projects.getColumn({
        columnId,
    });

    return column.name;
}
