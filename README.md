[![license](https://img.shields.io/github/license/mashape/apistatus.svg?maxAge=2592000)](https://opensource.org/licenses/MIT)
[![Build Status](https://travis-ci.org/webgme/webgme.svg?branch=master)](https://travis-ci.org/webgme/webgme)

# Constraint Checker
Evaluates constraints (meta-rules) on every commit to a project and integrates with the ProjectRepositoryWidget to display the results. The results are stored in mongodb, see below for how to configure mongo-uri etc.

![ProjectRepository](img/ProjectRepository.png "View the results for constraint-checking done on server")

Details about violations can be viewed for each commit.

![ConstraintDialog](img/ConstraintDialog.png "View details of the unfulfilled constraints")


## Using from other repository
Using the [webgme-cli](https://github.com/webgme/webgme-cli) the following pieces can be imported (execute from root of repository)...

#### Plugin
This should not be executed by the webhook only and will return an error at invocation from the UI.
```
webgme import plugin ConstraintChecker webgme-constraint-checker
```
#### Visualizer
The is visualizer is a commit-badge show the status of the checks - to integrate it with the ProjectRepositoryWidget see below.
```
webgme import viz ConstraintCheckerCommitBadge webgme-constraint-checker
```
#### Router
The router forwards result/status requests ensuring the user has the right access (route is used by the visualizer).
```
webgme import router ConstraintResults webgme-constraint-checker
```
#### Webhook
To run the webhook first make sure you've enabled webhooks in your gmeConfig, `config.webhooks.enable = true;`. Then add a reference to webhook in the package.json under scripts:
```json
  "scripts": {
    "webgme-constraint-checker": "webgme-constraint-checker"
  },
```

Finally invoke `npm run webgme-constraint-checker` from your repository's root directory.


### Configuring webhook/router
The default configuration is available at [components.json](config/components.json). If your repo does not have a `config/components.json` or the json lacks the key `'ConstraintCheckerHook'` the default will be used.
If you intend to make your own configuration make sure to copy all the keys.

#### Adding commit-badge
In order to add the commit-badge to the project repository widget copy over the settings at `GenericUIProjectRepositoryWidget` inside the [components.json](config/components.json).


## Developers
#### Running app
`npm run hook` and `npm start`.
#### Publish new release at npm
 ```
 npm version 1.0.0 -m "Release %s"
 git push origin master
 git checkout v1.0.0
 git push origin v1.0.0
 npm publish ./
 ```


