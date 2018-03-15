#!/usr/bin/env node

const assert = require("assert");

const Promise = require("bluebird");

const glob = require("glob");
const { createLogger } = require("bunyan");
const argv = require("minimist")(process.argv.slice(2));

const { readFile, readJson } = require("fs-extra");

const { Index } = require("../lib/client");

let { debug, core, schema, clear, encoding, batch, optimize, swap } = argv;

const [ url ] = argv._;
const sources = argv._.slice(1);

assert.ok(url, "No Solr URL given!");
assert.ok(core, "No Solr Core given!");

batch = batch || 1;
encoding = encoding || "utf-8";

const logger = createLogger({
    name: "solr-client",
    level: debug ? "trace" : "info"
});

const solrCore = new Index({ url, logger }).core(core);

let result = Promise.resolve(solrCore);

if (clear) {
    result = result.then(() => solrCore.clear());
}

if (schema) {
    result = result.then(() => readJson(schema));
    result = result.then(schema => solrCore.schema().update(...schema));
}


result = result.then(() => Promise.all(sources.map(
    source => new Promise((resolve, reject) => glob(
        source,
        { nodir: true },
        (err, matches) => err ? reject(err) : resolve(matches)
    ))
)));

result = result.then((sources) => sources.reduce((all, one) => all.concat(one), []));
result = result.then((sources) => {
    const batches = [];
    for (let i = 0, l = sources.length; i < l; i += batch) {
        batches.push(sources.slice(i, i + batch));
    }
    return batches;
});

result = result.then(
    (sources) => sources.length == 0 ? Promise.reject("No sources") : sources
);

result = result.map(
    (batch) => Promise.all(batch)
        .map(source => readFile(source, { encoding }))
        .then(docs => solrCore.update(docs)),
    { concurrency: 1 }
);

result = result.then(() => solrCore.commit());

if (swap || optimize) {
    result = result.then(() => solrCore.optimize());
}

if (swap) {
    result = result.then(() => solrCore.swap(swap));
}

result.catch((e) => { logger.fatal(e); process.exit(1); });