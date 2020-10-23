module.exports = {
    repositoryOwner: 'mathieumuller',
    repositoryName: 'github-issue-workflow',
    // the prefix for experts labels
    labelPrefixExpert: 'Expert:',
    // the prefix for types labels
    labelPrefixType: 'Type:',
    // the github bot name
    botName: 'github-actions[bot]',
    // the permanent reviewer
    permanentReviewer: 'mathieumuller',
    // the collaborator in charge of merges
    mergeator: 'Neime',
    // the minimum of reviewers requested for a pull request
    minimumuReviewersNumber: 3,
    // the minimum of approvals required to validate a pull request
    requiredApprovalsNumber: 3,
    // the list of collaborators allowed to review pull requests
    reviewers: [
        'Neime',
        'tibahut',
        'adpauly',
        'mathieumuller',
        'wirabelle',
    ],
    // the list of required reviewers by expertise domain
    experts: {
        "bank": "Neime",
        "order": "tibahut",
        "tender": "adpauly",
        "api": "mathieumuller",
        "search": "wirabelle",
        "shipping": "wirabelle",
        "promotion": "wirabelle",
        "importer": "mathieumuller",
        "exporter": "lliger",
        "product": "Neime",
        "price": "wirabelle",
        "wishlist": "tibahut",
        "contrat": "wirabelle",
        "dropshipping": "adpauly",
        "company": "Neime",
        "user": "Neime",
        "widget": "tibahut",
        "design": "Neime",
        "translation": "mathieumuller",
        "subscription": "Neime",
        "score": "Neime",
        "cache": "adpauly",
        "test": "adpauly",
        "email": "lliger",
        "message": "tibahut",
        "statistic": "adpauly",
        "php": "mathieumuller",
        "database": "Neime",
        "test": "adpauly",
        "cache": "wirabelle",
        "search": "wirabelle",
    },
    columnTriggeringPullRequest: 'In Progress',
    issueTypesTriggeringPullRequest: ['Type:Feature', 'Type:Bug'],
}