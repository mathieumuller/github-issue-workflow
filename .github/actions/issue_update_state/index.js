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

    console.log(octokit);

try {
    updateStateLabel();
} catch (error) {
    core.setFailed(error.message);
}

async function updateStateLabel() {
    // console.log(payload);
    let column = await getColumn();
        
    console.log(issueNumber);
    console.log(column);
    console.log(column.name);
    return;
    // remove all state labels of the issue
    removeStateLabels(issueNumber);

    // add the label corresponding to the content to the issue
    let columnName = column.name;
    addLabel(labels[columnName], issueNumber);
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
    let columnId = projectCard.column_id;
    console.log(columnId);
    return await octokit.projects.getColumn({
        columnId,
    });;
}

function basename(path) {
    return path.split('/').reverse()[0];
 }
