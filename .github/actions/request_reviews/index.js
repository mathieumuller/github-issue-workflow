/**
 * Octokit documentation : https://octokit.github.io/rest.js/v18
 *
 * PULL REQUEST WORKFLOW ACTION
 *
 * 1. The developer is done, he adds the status RFT to its pull request -> the pull request is locked (mergeable false) -> acceptance tests are triggered
 * 2. a. Tests fails -> add label FFF -> assign author , the developer fixes its PR and add the label RFT when he's done
 *    b. Tests success -> add label RFR -> unassign author + request and assign reviewers (permanent + 2 randoms)
 * 3. a. Review changes_requested -> unassign reviewer -> remove label RFR -> add label FFF -> developer fixes its PR and add the label RFT to reenter tests process after his fixes
 *    b. Review comments -> assign author -> nothing happens the developer answer the comment and the reviewer decides if he approves or refuse the PR
 *    c. Review approved -> unassign reviewer
 *    					 -> if 2 approvals and label is RFR -> remove label RFR -> add label RTM -> unassign author -> assign mergeator -> unlock PR
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
    author = pullRequest.user.login,
    pullNumber = pullRequest.number,
    reviewers = core.getInput('reviewers').split(';'),
    permanentReviewer = core.getInput('permanent_reviewer'),
    reviewersNumber = core.getInput('reviewers_number');

try {
    requestReviews();
} catch (error) {
    core.setFailed(error.message);
}

function addReviewer(reviewer, reviewersList) {
    if (author !== reviewer && !reviewersList.includes(reviewer)) {
        reviewersList.push(reviewer);
    }
}

/**
 * Requests reviewers on the pull request
 */
async function requestReviews() {
    let isRTM = await hasLabel('RTM');

    if (!isRTM) {
        let reviewers = await getReviewersList();
        // add the reviewers
        requestReviewers(reviewers);
        // unassign the author
        removeAssignees([author]);
        // assign the reviewers
        addAssignees(reviewers);
    }
}

/**
 * Build the reviewers list of a pull request
 */
async function getReviewersList() {
    // if some reviewers are already requested, keep them by default
    let requestedReviewers = await listCurrentReviewers(),
        // get all previous reviews for the pull request
        { data: reviews } = await octokit.pulls.listReviews({
            owner: repositoryOwner,
            repo: repositoryName,
            pull_number: pullNumber,
        });

    // always ensure that the permanentReviewer is requested
    addReviewer(permanentReviewer, requestedReviewers);

    // always request the reviewers who have left a non-approved review
    let rvwrs = []; // used to take in account only the last review of each collaborator
    reviews.reverse().forEach(function(review) {
        let reviewer = review.user.login;

        if (!rvwrs.includes(reviewer)) {
            rvwrs.push(reviewer);
            // only request review again if the reviewer has not previously approved
            if (review.state != 'APPROVED') {
                addReviewer(reviewer, requestedReviewers);
            }
        }
    });

    // while the configured number of reviewers is not reached, request random reviewers into the list of available reviewers
    shuffle(reviewers).forEach(function(rvwr) {
        if (requestedReviewers.length < reviewersNumber) {
            addReviewer(rvwr, requestedReviewers);
        }
    });

    return requestedReviewers;
}

/**
 * Get the list of already requested reviewers for the pull request
 */
async function listCurrentReviewers() {
    let { data: currentReviewers } = await octokit.pulls.listRequestedReviewers({
            owner: repositoryOwner,
            repo: repositoryName,
            pull_number: pullNumber,
        }),
        results = [];

    currentReviewers.users.forEach(function(reviewer) {
        addReviewer(reviewer.login, results);
    });

    return results;
}

/**
 * Request the given list of collaborators to the pull request review
 */
function requestReviewers(reviewers) {
    octokit.pulls.requestReviewers({
        owner: repositoryOwner,
        repo: repositoryName,
        pull_number: pullNumber,
        reviewers: reviewers,
    });
}

/**
 * Assign the given list of collaborators to the pull request
 */
function addAssignees(assignees) {
    octokit.issues.addAssignees({
        owner: repositoryOwner,
        repo: repositoryName,
        issue_number: pullNumber,
        assignees: assignees,
    });
}

/**
 * Unassign the given list of collaborators to the pull request
 */
function removeAssignees(assignees) {
    octokit.issues.removeAssignees({
        owner: repositoryOwner,
        repo: repositoryName,
        issue_number: pullNumber,
        assignees: assignees,
    });
}

/**
 * Shuffles array in place.
 */
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }

    return array;
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
