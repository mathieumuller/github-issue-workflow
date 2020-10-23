const core = require('@actions/core'),
    github = require('@actions/github'),
    tools = require('./tools.js'),
    config = require('./config.js'),
    token = core.getInput('token'),
    octokit = github.getOctokit(token),
    repositoryOwner = config.repositoryOwner,
    repositoryName = config.repositoryName;

module.exports = {
    /**
     * Get the pull request author even if created by git bot
     * @param {Issue} pullRequest 
     */
    getPullRequestAuthor: async function(pullRequest)
    {
        try {
            var author = pullRequest.user.login;
            
            // if the pull request was created by github bot -> find author into the metadata comment 
            if (author == config.botName) {
                let { data: comments } = await octokit.issues.listComments({
                    owner: repositoryOwner,
                    repo: repositoryName,
                    issue_number: pullRequest.number,
                });
            
                var metadata = null;
                comments.forEach(function (comment) {
                    let body = comment.body;
            
                    if (metadata === null && body.indexOf('github_metadata') > -1) {
                        let metadata = JSON.parse(body);
                        author = metadata.github_metadata.author;
                    }
                });
            }
            return author;
        } catch (error) {
            core.setFailed(error.message);
        }
    },
    /**
     * Retrieves the current labels of the pull request
     */
    getLabels: async function(pullRequest)
    {
        try {
            let { data: labels } = await octokit.issues.listLabelsOnIssue({
                owner: repositoryOwner,
                repo: repositoryName,
                issue_number: pullRequest.number,
            });
            var results = [];

            labels.forEach(function(label) {
                results.push(label.name);
            });
               
            return results;
        } catch (error) {
            core.setFailed(error.message);
        }
    }
}