const tools = require('../tools.js'),
    config = require('../config.js'),    
    core = require('@actions/core'),    
    github = require('@actions/github'),
    token = core.getInput('token'),
    context = github.context,
    octokit = github.getOctokit(token),
    payload = context.payload;

console.log(context);
console.log(payload);