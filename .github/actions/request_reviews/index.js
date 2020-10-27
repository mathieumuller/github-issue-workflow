/**
 * Octokit documentation : https://octokit.github.io/rest.js/v18
 */
const core = require('@actions/core'),
    github = require('@actions/github'),
    tools = require('../tools.js'),
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
    collaborators = config.reviewers,
    experts = config.experts,
    permanentReviewer = config.permanentReviewer,
    reviewersNumber = config.minimumuReviewersNumber,
    botName = config.botName,
    expertPrefix = config.labelPrefixExpert;

var labels = [],
    lastReviews = {},
    author = null;

try {
    process();
} catch (error) {
    core.setFailed(error.message);
}

/**
 * Requests reviewers on the pull request
 */
async function process() {
    try {
        author = await commons.getPullRequestAuthor(pullRequest);
        labels = await commons.getLabels(pullRequest);
        let isRTM = labels.includes('RTM'),
            isFFF = labels.includes('FFF');
    
        if (!isRTM) {
            let reviews = await getReviews();
            // get the last review state by reviewer
            reviews.reverse().forEach(function (review) {
                let reviewer = review.user.login;

                if (lastReviews[reviewer] == undefined) {
                    lastReviews[reviewer] = review.state;
                }
            });

            let reviewers = await getReviewers();
            
            // add the reviewers
            octokit.pulls.requestReviewers({
                owner: repositoryOwner,
                repo: repositoryName,
                pull_number: pullNumber,
                reviewers: reviewers,
            });

            // unassign the author if not in request_changes status
            if (!isFFF) {
                octokit.issues.removeAssignees({
                    owner: repositoryOwner,
                    repo: repositoryName,
                    issue_number: pullNumber,
                    assignees: [author],
                });
            }
    
            // assign the reviewers
            octokit.issues.addAssignees({
                owner: repositoryOwner,
                repo: repositoryName,
                issue_number: pullNumber,
                assignees: reviewers,
            });
        }
    } catch (error) {
        core.setFailed(error.message);
    }
}

/**
 * List all the reviews of the pull request (review_date ASC)
 */
async function getReviews()
{
    try {
        let { data: reviews } = await octokit.pulls.listReviews({
            owner: repositoryOwner,
            repo: repositoryName,
            pull_number: pullNumber,
        });
    
        return reviews;
    } catch (error) {
        core.setFailed(error.message);
    }
}

/**
 * Get the existent reviewers list or create a new one
 */
async function getReviewers()
{
    try {
        // get the reviewers whose are already requested
        var reviewers = await listCurrentReviewers();
        // request all the reviewers whose have left a 'non approved' review before 
        for (const [reviewer, value] of Object.entries(lastReviews)) {
            addReviewer(reviewer, reviewers);    
        }
    
        // if no reviewer has already been requested then get permanent + experts + random
        if (reviewers.length == 0) {
            expertReviewers = await getExperts();
            expertReviewers.forEach(function(reviewer) {
                addReviewer(reviewer, reviewers);    
            });
            // add th permanent reviewer
            addReviewer(permanentReviewer, reviewers);
    
            // add random reviewer until required number of reviewers is reached
            tools.shuffle(collaborators).forEach(function(reviewer) {
                if (reviewers.length < reviewersNumber) {
                    addReviewer(reviewer, reviewers);
                }
            });
        }
    
        return reviewers;
    } catch (error) {
        core.setFailed(error.message);
    }
}


/**
 * Get the list of already requested reviewers for the pull request
 */
async function listCurrentReviewers() {
    try {
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
    } catch (error) {
        core.setFailed(error.message);
    }
}

/**
 * Retrieves the experts to assign to the pull request
 */
async function getExperts()
{
    try {
        let results = [];
    
        labels.forEach(function(label) {
            if (label.indexOf(expertPrefix) === 0) {
                let domain = label.substring(expertPrefix.length).toLowerCase();
                
                if (experts[domain] != undefined) {
                    addReviewer(experts[domain], results);
                }
            }
        });
    
        return results;
    } catch (error) {
        core.setFailed(error.message);
    }
}

function addReviewer(reviewer, reviewersList) {
    if (botName !== reviewer // never add the git bot as a reviewer
        && author !== reviewer // cannot assign the pull request author as a reviewer
        && !reviewersList.includes(reviewer) // don't assign a reviewer twice
        && !(reviewer != permanentReviewer && lastReviews[reviewer] == 'APPROVED') // don't request the reviewer if its last review is approved (except for permanentReviewer)
    ) {
        reviewersList.push(reviewer);
    }
}
