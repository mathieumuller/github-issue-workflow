const core = require('@actions/core'),
    github = require('@actions/github'),
    { request } = require("@octokit/request"),
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
    // remove all state labels of the issue
    removeStateLabels();
    
    // add the label corresponding to the content to the issue
    let column = await getColumn(),
        columnName = column.name;

    addLabel(labels[columnName]);
}

function addLabel(label) {
    octokit.issues.addLabels({
        owner: repositoryOwner,
        repo: repositoryName,
        issue_number: issueNumber,
        name: label
    });
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
        if (currentLabel.name.substring(0, 5) === stateLabelPrefix) {
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
    
    let {data: toto} = 
    octokit.projects.getColumn({
      column_id: columnId,
    });
    console.log(toto);

    let { data: column } = await request("/projects/columns/"+columnId, {
        method: "GET",
        headers: {
          authorization: "token "+core.getInput('token'),
        },
        mediaType: {
            format: 'JSON',
            previews: ['inertia-preview']
        },
        org: "uppler",
        type: "private",
      });

      return column;
}

function basename(path) {
    return path.split('/').reverse()[0];
 }
