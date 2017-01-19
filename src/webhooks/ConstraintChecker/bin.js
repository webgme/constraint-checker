/*jshint node: true*/
/**
 * @author pmeijer / https://github.com/pmeijer
 */


var Command = require('commander').Command,
    program = new Command(),
    Handler = require('./ConstraintChecker'),
    handler;

program
    .version('1.0.0')
    .description('Starts a webhook handler server that evaluates the constraints using ConstraintChecker plugin. ' +
        'The cwd should be the root directory of the webgme domain repo and the gmeConfig used can be altered using ' +
        'the environment variable NODE_ENV.')
    .option('-p, --port [number]', 'Port the webhook-handler should listen at [see config/component.json]')
    .option('-u, --mongoUri [string]', 'Mongodb URI where data is persisted [see config/component.json]')
    .on('--help', function () {
        console.log('  Examples:');
        console.log();
        console.log('    $ node constraintChecker.js');
        console.log('    $ node constraintChecker.js -p 8080');
        console.log('    $ node constraintChecker.js -u mongodb://127.0.0.1:27017/webgme_constraint_results');
        console.log();
    })
    .parse(process.argv);


handler = new Handler(program);

handler.start(function (err) {
    if (err) {
        console.error(err);
        process.exit(1);
    }

    console.log('Started successfully!');
});

process.on('SIGINT', function () {
    handler.stop(function (err) {
        if (err) {
            console.error(err);
            process.exit(1);
        } else {
            process.exit(0);
        }
    });
});
