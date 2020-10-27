/**
 * Octokit documentation : https://octokit.github.io/rest.js/v18
 *
 * Check if the pull request has enough approvals to be merged
 */
const core = require('@actions/core'),
    github = require('@actions/github'),
    config = require('../config.js'),
    commons = require('../commons.js'),
    token = core.getInput('token'),
    context = github.context, 
    octokit = github.getOctokit(token),
    payload = context.payload,
    repositoryOwner = config.repositoryOwner,
    repositoryName = config.repositoryName,
    pullRequest = payload.pull_request,
    pullNumber = pullRequest.number;

var author = null;


try {
    process();
} catch (error) {
    core.setFailed(error.message);
}

async function process() {
    let branch = pullRequest.head,
        initialSha = branch.sha; //this is the initial sha, when the action was triggered (before the test suite)

    author = await commons.getPullRequestAuthor(pullRequest);
    var message = ":trophy: Les tests d' acceptance ont été exécutés avec succès :trophy:",
        status = 'APPROVE';

    // IN CASE OF FAILURE OR IN CASE OF CHANGES DURING TESTS SUITE EXECUTION
    if ('false' == core.getInput('success')) {
        status = 'REQUEST_CHANGES';
        message = ":boom: La suite de tests d'acceptance a échoué. Merci de corriger les erreurs et de repasser la PR à RFR afin de réexécuter la suite de tests. :boom: ";

        // Assign the author of the pull request
        console.log('Assign author');
        octokit.issues.addAssignees({
            owner: repositoryOwner,
            repo: repositoryName,
            issue_number: pullNumber,
            assignees: [author],
        });

        // Remove label RFR
        console.log('Remove label RFR');
        octokit.issues.removeLabel({
            owner: repositoryOwner,
            repo: repositoryName,
            issue_number: pullNumber,
            name: 'RFR',
        });

        // Add label FFF
        console.log('Add label FFF');
        octokit.issues.addLabels({
            owner: repositoryOwner,
            repo: repositoryName,
            issue_number: pullNumber,
            labels: ['FFF'],
        });
    } 

    console.log('Create the review with status ' + status);
    octokit.pulls.createReview({
        owner: repositoryOwner,
        repo: repositoryName,
        pull_number: pullNumber,
        event: 'COMMENT',
        body: JSON.stringify({
          "status": status,
          "message": message,
          "sha": initialSha  
        }, null, 2)
    });
}
