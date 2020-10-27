const commons = require('../commons.js'),
    config = require('../config.js'),    
    core = require('@actions/core'),    
    github = require('@actions/github'),
    token = core.getInput('token'),
    context = github.context,
    octokit = github.getOctokit(token),
    payload = context.payload,
    repositoryOwner = config.repositoryName,
    repositoryName = config.repositoryOwner;

try {
    process();
} catch (error) {
    core.setFailed(error.message);
}

async function process()
{
    try {
        // list the queued workflow runs of the branch we just pushed on
        let 
            branch = payload.ref.replace('refs/heads/', ''),
            
            {data: listQueued} = await octokit.actions.listWorkflowRuns({
                owner: repositoryOwner,
                repo: repositoryName,
                workflow_id: core.getInput('workflow'),
                branch: branch,
                status: 'queued'
            }),
            // list the runnning workflow runs of the branch we just pushed on
            {data: listInProgress} = await octokit.actions.listWorkflowRuns({
            owner: repositoryOwner,
            repo: repositoryName,
            workflow_id: core.getInput('workflow'),
            branch: branch,
            status: 'in_progress'
        }),
        runs = listQueued.workflow_runs.concat(listInProgress.workflow_runs),
        hasCanceledRuns = false;

        if(runs.length == undefined || runs.length == 0) {
            console.log('No run of ' + core.getInput('workflow') + ' is currently running or in queue');
            return;
        }
        console.log(runs.length + ' runs of ' + core.getInput('workflow') + ' are currently running');
        // cancel the runs
        runs.forEach(function(run) {
            // do not cancel the tests on the same commit (avoid push + RFR events conflicts)
            if (run.head_sha !== payload.after) {
                hasCanceledRuns = true;
                console.log('Canceling run '+run.id+' of workflow '+core.getInput('workflow'));
                octokit.actions.cancelWorkflowRun({
                    owner: repositoryOwner,
                    repo: repositoryName,
                    run_id: run.id,
                });
            }
        });

        if (!hasCanceledRuns) {
            console.log('No run of ' + core.getInput('workflow') + ' has outdated source, nothing was cancelled');
            return;
        }

        //try to get the pull request associated to the branch and tag 
        let { data: pullRequests } = await octokit.pulls.list({
            owner: repositoryOwner,
            repo: repositoryName,
            head: repositoryOwner+":"+branch,
            state: "open"
        });

        // For each active pull requuest of the branch we pushed on -> refuse acceptance tests
        pullRequests.forEach(async function(pullRequest) {
            // remove the labels Testing, RFR or RTM
            let labels = await commons.getLabels(pullRequest),
                pullNumber = pullRequest.number,
                author = await commons.getPullRequestAuthor(pullRequest);

            // Assign the author of the pull request
            console.log('Assign the pull request author (' + author + ')');
            octokit.issues.addAssignees({
                owner: repositoryOwner,
                repo: repositoryName,
                issue_number: pullNumber,
                assignees: [author],
            });

            // remove the labels Testing, RFR or RTM
            if (labels.includes('Testing')) {
                console.log('Remove Testng label');
                removeLabel(pullRequest, 'Testing');
            }
            if (labels.includes('RFR')) {
                console.log('Remove RFR label');
                removeLabel(pullRequest, 'RFR');
            }
            if (labels.includes('RTM')) {
                console.log('Remove label RTM');
                removeLabel(pullRequest, 'RTM');
            }

            // add the label FFF
            console.log('Add label FFF');
            octokit.issues.addLabels({
                owner: repositoryOwner,
                repo: repositoryName,
                issue_number: pullNumber,
                labels: ['FFF'],
            });

            // add a request_changes review by Gitbot
            console.log('Creates a gitbot review refusing the canceled tests');
            octokit.pulls.createReview({
                owner: repositoryOwner,
                repo: repositoryName,
                pull_number: pullNumber,
                event: 'COMMENT',
                body: JSON.stringify({
                    "status": "REQUEST_CHANGES",
                    "message": ":warning: Le code évalué par la suite de tests d'acceptance n'est plus à jour. Merci de repasser la PR au statut RFR afin de réexécuter la suite de tests.  :warning: "
                }, null, 2)
            });
        });
    } catch (error) {
        core.setFailed(error.message);
    }
}

async function removeLabel(pullRequest, label) {
    try {
        octokit.issues.removeLabel({
            owner: repositoryOwner,
            repo: repositoryName,
            issue_number: pullRequest.number,
            name: label,
        });
    } catch (error) {
        core.setFailed(error.message);
    }
}