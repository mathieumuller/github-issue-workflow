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
    let issue = await getIssue(),
        issueNumber = issue.number
        column = await getColumn(),
        columnName = column.name;

    console.log(issue, issueNumber, column, columnName, labels, labels[columnName]);
    return;
        
    // remove all state labels of the issue
    removeStateLabels(issueNumber);
    // add the label corresponding to the content to the issue
    console.log(projectCard.content_id, labels);
    let columnName = await getColumnName(projectCard.column_id);

    console.log(columnName, labels[columnName]);
    addLabel(labels[columnName], issueNumber);
}

function basename(path) {
    return path.split('/').reverse()[0];
}

function addLabel(label, issueNumber) {
    let lbs = [label];
    octokit.issues.addLabels({
        repositoryOwner,
        repositoryName,
        issueNumber,
        lbs,
    });
}

async function removeStateLabels(issueNumber) {
    // get all the current labels of the issue
    let { data: currentLabels } = await octokit.issues.listLabelsOnIssue({
        owner: repositoryOwner,
        repo: repositoryName,
        issue_number: issueNumber,
    });

    // and remove those with the 'State:' prefix
    currentLabels.forEach(function(currentLabel) {
        if (currentLabel.name.substring(0, 5) === stateLabelPrefix) {
            removeLabel(currentLabel.name, issueNumber);
        }
    });
}

async function removeLabel(label, issueNumber) {
    octokit.issues.removeLabel({
        owner: repositoryOwner,
        repo: repositoryName,
        issue_number: issueNumber,
        name: label,
    });
}

async function getColumn() {
    let columnUrl = projectCard.column_url
    return await octokit.request({ columnUrl });
}

async function getIssue() {
    let columnUrl = projectCard.content_url
    return await octokit.request({ contentUrl });
}
