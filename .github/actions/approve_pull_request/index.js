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
    pullNumber = pullRequest.number,
    permanentReviewer = config.permanentReviewer,
    mergeator = config.mergeator,
    approvalsNumber = config.requiredApprovalsNumber,
    experts = config.experts,
    botName = config.botName,
    expertPrefix = config.labelPrefixExpert;

var labels = [],
    author = null;

try {
    process();
} catch (error) {
    core.setFailed(error.message);
}

/**
 * To be approved, a pull request must have :
 *  - have the github-actions approval (acceptance tests)
 *  - the permanent reviewer approval
 *  - all the experts (if any) approvals
 *  - at least 2 approvals
 */
async function process() {
    author = await commons.getPullRequestAuthor(pullRequest);
    labels = await commons.getLabels(pullRequest);
    let canApprove = labels.includes('RFR') && !labels.includes('Testing');

    // pull request must have RFR label to be approved
    if (canApprove) {
        var approvals = await getLastApprovals();

        // if not enough approvals -> return
        if (approvals.length < approvalsNumber) {
            console.log(approvals.length + '/' + approvalsNumber + ' reviewers have approved the pull request yet');
            return;
        }

        // if acceptance tests refused -> return
        if (!approvals.includes(botName)) {
            console.log('Acceptance tests are notapproved yet for this pull request');
            return;
        }

        // if the permanent reviewer has not approved yet -> return (skip if permanenet reviewer is the author)
        if (!approvals.includes(permanentReviewer) && permanentReviewer != author) {
            console.log('The permanent reviewer (' + permanentReviewer + ') has not approved the pull request yet.');
            return;
        }

         // if all the requested experts has not approved yet -> return
        let expertReviewers = await getExperts(),
            hasExpertApprovals = true;

        expertReviewers.forEach(function(exp) {
            if (!approvals.includes(exp)) {
                console.log('The required expert ' + exp + ' has not approved the pull request yet');
                hasExpertApprovals = false;
            }
        });

        if (!hasExpertApprovals) {
            return;
        }
    
        // remove RFR and add RTM labels
        console.log('Add label RTM');
        octokit.issues.addLabels({
            owner: repositoryOwner,
            repo: repositoryName,
            issue_number: pullNumber,
            labels: ['RTM'],
        });

        console.log('Remove label RFR');
        octokit.issues.removeLabel({
            owner: repositoryOwner,
            repo: repositoryName,
            issue_number: pullNumber,
            name: 'RFR',
        });

        // unassign reviewers + author and assign mergeator
        console.log('Unassign everybody');
        unassignAll();
        console.log('Assign Mergeator');
        octokit.issues.addAssignees({
            owner: repositoryOwner,
            repo: repositoryName,
            issue_number: pullNumber,
            assignees: [mergeator],
        });
    }

    console.log('Pull request cannot be approved as it does not have the label RFR or is currently testing');
}

async function getLastApprovals()
{
    let { data: reviews } = await octokit.pulls.listReviews({
        owner: repositoryOwner,
        repo: repositoryName,
        pull_number: pullNumber,
    }),
    rvwrs = [];
    var approvers = [];

    // loop over last reviews until the required number of approvals (one by reviewer!) is reached
    reviews.reverse().forEach(function(review) {
        let reviewer = review.user.login;

        if (!rvwrs.includes(reviewer)) {
            rvwrs.push(reviewer);
            // if the reviewer is the git bot, then the review status is in the review body as it is not possible to approve/request_changes its own PR
            let isApproved = reviewer != config.botName 
                ? review.state == 'APPROVED'
                : JSON.parse(review.body).status == 'APPROVE'
            ;

            if (isApproved && !approvers.includes(reviewer)) {
                if (
                    // ok if reviewer is a collaborator 
                    reviewer != config.botName 
                    // if reviewer is the gitbot (tests), then we must compare the sha of the review with the current one to be sure that the last code has been tested
                    || (reviewer == config.botName && JSON.parse(review.body).sha == pullRequest.head.sha) 
                ) {
                    approvers.push(reviewer);
                }
            }
        } 
    });

    return approvers;
}

/**
 * Unassign the reviewers of the pull request
 */
async function unassignAll() {
    unassigned = [];
    pullRequest.assignees.forEach(function(assignee) {
        unassigned.push(assignee.login);
    });

    octokit.issues.removeAssignees({
        owner: repositoryOwner,
        repo: repositoryName,
        issue_number: pullNumber,
        assignees: unassigned,
    });
}

/**
 * Retrieves the experts to assign to the pull request
 */
async function getExperts()
{
    let results = [];

    labels.forEach(function(label) {
        if (label.indexOf(expertPrefix) === 0) {
            let domain = label.substring(expertPrefix.length).toLowerCase();

            if (experts[domain] != undefined) {
                results.push(experts[domain]);
            }
        }
    });

    return results;
}
