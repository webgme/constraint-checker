# Constraint Checker
Evaluates constraints (meta-rules) on every commit to a project.

## Use from this repository
```
npm run webhook
```

## Using from other repository
Using the [webgme-cli](https://github.com/webgme/webgme-cli) the following pieces can be imported (execute from root of repository)...
First make sure you have this repository as a dependency:

```
npm install --save github:webgme/constraint-checker
```

(Note when published on npm and if you do not want the master branch do: `npm install webgme-constraint-checker`)

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
To start the webhook handler - do `TODO: command that runs .bin command`.

### Configuring webhook/router
The default configuration is available at [components.json](config/components.json). If your repo does not have a `config/components.json` or the json lacks the key `'ConstraintCheckerHook'` the default will be used.
If you intend to make your own configuration make sure to copy all the keys.

#### Adding commit-badge
In order to add the commit-badge to the project repository widget copy over the settings at `GenericUIProjectRepositoryWidget` inside the [components.json](config/components.json).
