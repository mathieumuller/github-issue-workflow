/**
 * Octokit documentation : https://octokit.github.io/rest.js/v18
 *
 * Add a label and remove another one from the pull request
 */
const core = require('@actions/core'),
    github = require('@actions/github'),
    config = require('../config.js'),
    commons = require('../commons.js'),
    token = core.getInput('token'),
    labelToAdd = core.getInput('addLabel'),
    labelToRemove = core.getInput('removeLabel'),
    collaboratorToAssign = core.getInput('assign'),
    collaboratorToUnassign = core.getInput('unassign'),
    octokit = github.getOctokit(token),
    repositoryOwner = config.repositoryOwner,
    repositoryName = config.repositoryName,
    pullRequest = github.context.payload.pull_request,
    pullNumber = pullRequest.number;

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

async function removeLabel(label) {
    let labels  = await commons.getLabels(pullRequest);
    let labelExists = labels.includes(label);

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
async function assign(assignee) {
    // get the real author of the pull request (in case of github bot creation)
    if ('author' == assignee) {
        assignee = await commons.getPullRequestAuthor(pullRequest);
    }

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
    // get the real author of the pull request (in case of github bot creation)
    if ('author' == assignee) {
        assignee = await commons.getPullRequestAuthor(pullRequest);
    }

    octokit.issues.removeAssignees({
        owner: repositoryOwner,
        repo: repositoryName,
        issue_number: pullNumber,
        assignees: [assignee],
    });
}

