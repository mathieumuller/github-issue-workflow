const core = require('@actions/core'),
    github = require('@actions/github'),
    token = core.getInput('token'),
    context = github.context,
    octokit = github.getOctokit(token),
    payload = context.payload,
    repository = process.env.GITHUB_REPOSITORY,
    repositoryOwner = repository.split('/')[0],
    repositoryName = repository.split('/')[1],
    typeLabelPrefix = core.getInput('typeLabelPrefix'),
    expertLabelPrefix = core.getInput('expertLabelPrefix'),
    labelToListen = core.getInput('labelToListen'),
    projectCard = payload.project_card,
    issueNumber = basename(projectCard.content_url);

try {
    createPullRequest();
} catch (error) {
    core.setFailed(error.message);
}

async function createPullRequest() {
    // only create the pull request when the issue has "in progress" label
    if (!hasLabel(labelToListen)) {
        return;
    }
console.log(payload);
    let issue = await getIssue(),
    author = payload.sender.login,
    milestone = issue.milestone.title,
    subject = stringToSlug(issue.title),
    type = await getType(),
    name = '[' +type+ '][' +milestone+ '] '+ subject;
    console.log(issue);
}

async function hasLabel(label) {
    let { data: currentLabels } = await octokit.issues.listLabelsOnIssue({
        owner: repositoryOwner,
        repo: repositoryName,
        issue_number: issueNumber,
    });

    let labelExists = false;
    currentLabels.forEach(function(currentLabel) {
        if (currentLabel.name == label) {
            labelExists = true;
        }
    });

    return labelExists;
}

// function addLabel(label) {
//     octokit.issues.addLabels({
//         owner: repositoryOwner,
//         repo: repositoryName,
//         issue_number: issueNumber,
//         labels: [label]
//     });
// }

async function getIssue()
 {
    let { data: issue } = await octokit.issues.get({
        owner: repositoryOwner,
        repo: repositoryName,
        issue_number: issueNumber,
      });

      return issue;
 }

async function getType() {
    // get all the current labels of the issue
    let { data: currentLabels } = await octokit.issues.listLabelsOnIssue({
        owner: repositoryOwner,
        repo: repositoryName,
        issue_number: issueNumber
    });

    // and remove those with the 'State:' prefix
    currentLabels.forEach(function(currentLabel) {
        if (currentLabel.name.substring(0, typeLabelPrefix.length) === typeLabelPrefix) {
            type = currentLabel.name.substring(typeLabelPrefix.length);
        }
    });

    console.log(type);

    return type;
}

// async function removeLabel(label) {
//     octokit.issues.removeLabel({
//         owner: repositoryOwner,
//         repo: repositoryName,
//         issue_number: issueNumber,
//         name: label
//     });
// }



function basename(path) {
    return path.split('/').reverse()[0];
}

function stringToSlug (str) {
    str = str.replace(/^\s+|\s+$/g, ''); // trim
    str = str.toLowerCase();
  
    // remove accents, swap ñ for n, etc
    var from = "àáäâèéëêìíïîòóöôùúüûñç·/_,:;";
    var to   = "aaaaeeeeiiiioooouuuunc------";
    for (var i=0, l=from.length ; i<l ; i++) {
        str = str.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
    }

    str = str.replace(/[^a-z0-9 -]/g, '') // remove invalid chars
        .replace(/\s+/g, '-') // collapse whitespace and replace by -
        .replace(/-+/g, '-'); // collapse dashes

    return str;
}

