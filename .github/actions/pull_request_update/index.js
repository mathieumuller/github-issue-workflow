/**
 * Octokit documentation : https://octokit.github.io/rest.js/v18
 *
 * Add a label and remove another one from the pull request
 */
const core = require('@actions/core'),
    github = require('@actions/github'),
    token = core.getInput('token'),
    labelToAdd = core.getInput('addLabel'),
    labelToRemove = core.getInput('removeLabel'),
    collaboratorToAssign = core.getInput('assign'),
    collaboratorToUnassign = core.getInput('unassign'),
    octokit = github.getOctokit(token),
    repository = process.env.GITHUB_REPOSITORY,
    repositoryOwner = repository.split('/')[0],
    repositoryName = repository.split('/')[1],
    pullNumber = github.context.payload.pull_request.number;

try {
    if (labelToRemove.length > 0) {
        removeLabel(labelToRemove);
    }

    if (labelToAdd.length > 0) {
        addLabel(labelToAdd);
    }

    if (collaboratorToAssign.length > 0) {
        assign(collaboratorToAssign);
    }

    if (collaboratorToUnassign.length > 0) {
        unassign(collaboratorToUnassign);
    }
} catch (error) {
    core.setFailed(error.message);
}

async function hasLabel(label) {
    let { data: currentLabels } = await octokit.issues.listLabelsOnIssue({
            owner: repositoryOwner,
            repo: repositoryName,
            issue_number: pullNumber,
        }),
        labelExists = false;

    currentLabels.forEach(function(currentLabel) {
        if (currentLabel.name == label) {
            labelExists = true;
        }
    });

    return labelExists;
}

async function removeLabel(label) {
    let labelExists = await hasLabel(label);
    if (labelExists) {
        octokit.issues.removeLabel({
            owner: repositoryOwner,
            repo: repositoryName,
            issue_number: pullNumber,
            name: label,
        });
    }
}

function addLabel(label) {
    octokit.issues.addLabels({
        owner: repositoryOwner,
        repo: repositoryName,
        issue_number: pullNumber,
        labels: [label],
    });
}

/**
 * Assign the given list of collaborators to the pull request
 */
function assign(assignee) {
    octokit.issues.addAssignees({
        owner: repositoryOwner,
        repo: repositoryName,
        issue_number: pullNumber,
        assignees: [assignee],
    });
}

/**
 * Unassign the reviewers of the pull request
 */
async function unassign(assignee) {
    octokit.issues.removeAssignees({
        owner: repositoryOwner,
        repo: repositoryName,
        issue_number: pullNumber,
        assignees: [assignee],
    });
}
