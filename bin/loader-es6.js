import "babel-polyfill";

import assert from "assert";

import globby from "globby";

import minimist from "minimist";

const { readFile, readJson } = require("fs-extra");

import solr from "../index";

const argv = minimist(process.argv.slice(2));

const { core, schema, clear, encoding, batch, optimize, swap } = {
    batch: 1,
    encoding: "utf-8",
    ...argv
};
const [ url, ...sourceGlobs ] = argv._;

assert.ok(url, "No Solr URL given!");
assert.ok(core, "No Solr Core given!");

(async function() {
    try {
        const solrCore = solr({ url }).core(core);

        if (clear) {
            await solrCore.clear();
        }

        if (schema) {
            const schemaData = await readJson(schema);
            await solrCore.schema().update(...schemaData);
        }

        const sources = await globby(sourceGlobs);
        const batches = [];
        for (let i = 0, l = sources.length; i < l; i += batch) {
            batches.push(sources.slice(i, i + batch));
        }

        if (batches.length == 0) {
            throw new Error("No sources");
        }

        for (const batch of batches) {
            const docs = await Promise.all(batch.map(
                source => readFile(source, { encoding })
            ));
            await solrCore.update(docs);
        }

        await solrCore.commit();

        if (swap || optimize) {
            await solrCore.optimize();
        }

        if (swap) {
            await solrCore.swap(swap);
        }
    } catch (err) {
        console.error(err); // eslint-disable-line no-console
        process.exit(1);
    }
})();
