assert = require "assert"
globby = require "globby"
minimist = require "minimist"

debug = require "debug"
log = debug "solr-client"

{ readFile, readJson } = require "fs-extra"

solr = require "./solr"

[node, cmd, argv...] = process.argv
argv = minimist argv;

defaults =
    batch: 1
    encoding: "utf-8"

{ core, schema, clear, encoding, batch, optimize, swap } = {
    defaults...,
    argv... }

[ url, sourceGlobs... ] = argv._

assert.ok url, "No Solr URL given!"
assert.ok core, "No Solr Core given!"
assert.ok sourceGlobs.length isnt 0, "No sources given!"

main = () ->
    try
        index = solr { url }
        index = index.core core

        if (clear)
            await index.clear()

        if (schema?)
            schemaData = await readJson schema
            try
                schema = await index.schema().get()
                await schema.update schemaData...
            catch e
                log e

        sources = await globby sourceGlobs
        batches = for i in [0...sources.length] by batch
            sources.slice i, i + batch

        throw new Error "No sources" if batches.length is 0

        for docs in batches
            docs = (readFile doc, { encoding } for doc in docs)
            docs = await Promise.all docs
            await index.update docs

        await index.commit()

        await index.optimize() if swap? or optimize
        await index.swap swap if swap?
    catch err
        console.error err
        process.exit 1

main()