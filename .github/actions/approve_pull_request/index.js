/**
 * Octokit documentation : https://octokit.github.io/rest.js/v18
 *
 * Check if the pull request has enough approvals to be merged
 */
const core = require('@actions/core'),
    github = require('@actions/github'),
    token = core.getInput('token'),
    context = github.context,
    octokit = github.getOctokit(token),
    payload = context.payload,
    repository = process.env.GITHUB_REPOSITORY,
    repositoryOwner = repository.split('/')[0],
    repositoryName = repository.split('/')[1],
    pullRequest = payload.pull_request,
    pullNumber = pullRequest.number,
    author = pullRequest.user.login,
    labelApprovable = core.getInput('label_approvable'),
    labelApproved = core.getInput('label_approved'),
    permanentReviewer = core.getInput('permanent_reviewer'),
    mergeator = core.getInput('mergeator'),
    approvalsNumber = core.getInput('approvals_number');

try {
    approves();
} catch (error) {
    core.setFailed(error.message);
}

/**
 * Check that the RFR pull request has at least 2 approvals and the permanent reviewer approval
 */
async function approves() {
    let canApprove = await hasLabel(labelApprovable);

    // pull request must have RFR label to be approved
    if (canApprove) {
        let approvers = [],
            hasPermanentReviewerApproval = author == permanentReviewer,
            { data: reviews } = await octokit.pulls.listReviews({
                owner: repositoryOwner,
                repo: repositoryName,
                pull_number: pullNumber,
            });

        // loop over last reviews until the required number of approvals (one by reviewer!) is reached
        reviews.reverse().forEach(function(review) {
            if ('APPROVED' == review.state) {
                let reviewer = review.user.login;

                if (!approvers.includes(reviewer)) {
                    approvers.push(reviewer);
                    if (reviewer == permanentReviewer) {
                        hasPermanentReviewerApproval = true;
                    }
                }
            }
        });

        if (hasPermanentReviewerApproval && approvers.length >= approvalsNumber) {
            // remove RFR and add RTM labels
            addLabels([labelApproved]);
            removeLabel(labelApprovable);

            // unassign reviewers + author and assign mergeator
            unassignAll();
            addAssignees([mergeator]);
        }
    }
}

/**
 * Unassign the reviewers of the pull request
 */
async function unassignAll() {
    unassigned = [];
    pullRequest.assignees.forEach(function(assignee) {
        unassigned.push(assignee.login);
    });

    removeAssignees(unassigned);
}

function addAssignees(assignees) {
    octokit.issues.addAssignees({
        owner: repositoryOwner,
        repo: repositoryName,
        issue_number: pullNumber,
        assignees: assignees,
    });
}

function removeAssignees(assignees) {
    octokit.issues.removeAssignees({
        owner: repositoryOwner,
        repo: repositoryName,
        issue_number: pullNumber,
        assignees: assignees,
    });
}

async function hasLabel(label) {
    let { data: currentLabels } = await octokit.issues.listLabelsOnIssue({
        owner: repositoryOwner,
        repo: repositoryName,
        issue_number: pullNumber,
    });

    let labelExists = false;
    currentLabels.forEach(function(currentLabel) {
        if (currentLabel.name == label) {
            labelExists = true;
        }
    });

    return labelExists;
}

async function removeLabel(label) {
    octokit.issues.removeLabel({
        owner: repositoryOwner,
        repo: repositoryName,
        issue_number: pullNumber,
        name: label,
    });
}

function addLabels(labels) {
    octokit.issues.addLabels({
        owner: repositoryOwner,
        repo: repositoryName,
        issue_number: pullNumber,
        labels: labels,
    });
}
