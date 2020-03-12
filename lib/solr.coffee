{ URL } = require "url"
axios = require "axios"
netrc = require "netrc"

netrcCredentials = (url) ->
    { host } = new URL url
    credentials = netrc()
    credentials = credentials[host] ? {}
    { login, password } = credentials
    { user: login, password }

defaultOptions =
    params: {}

class Index

    constructor: (options={}) ->
        url = options.url ? "http://localhost/solr/"
        url = url.replace /\/+$/, ""

        credentials = netrcCredentials url
        { user, password } = { credentials..., options... }

        @url = url
        @user = user
        @pass = password

    request: (args...) ->
        [ options, path... ] = args;

        if (typeof options == "string")
            path.unshift options
            options = {};

        auth = undefined
        if @user? and @pass?
            auth =
                user: @user
                pass: @pass
                sendImmediately: true

        url = [@url, path...].join "/"
        requestOptions =
            url: url,
            auth: auth,
            params: { (options.qs ? {})...,  wt: "json" }

        delete options.qs
        options = { defaultOptions..., options..., requestOptions... }

        res = await axios options

        throw res if res.data.responseHeader.status isnt 0
        res.data

    status: () -> @request { qs: { "action": "status" } }, "admin", "cores"

    core: (name) -> new Core this, name

class Core

    constructor: (@index, @name) ->

    schema: () -> new Schema @index, @name

    request: (opts, path...) ->
        @index.request opts, @name, path...

    select: (qs, opts={}) ->
        @request { qs, opts... }, "select"

    command: (body) ->
        headers = { "Content-Type": "application/xml;charset=UTF-8" };
        @request { method: "POST", headers, data: body }, "update"

    update: (documents) ->
        documents = (doc.replace /^<\?xml(.+?)\?>\s*/, "" for doc in documents)
        @command ["<add>", documents..., "</add>"].join ""

    clear: () -> @command "<delete><query>*:*</query></delete>"

    commit: () -> @command "<commit/>"

    optimize: () -> @command "<optimize/>"

    swap: (other) ->
        qs =
            action: "SWAP",
            core: @name
            other: other

        @index.request { qs }, "admin", "cores"


SCHEMA_UPDATE_COMMANDS = [
    "add-field",
    "delete-field",
    "replace-field",
    "add-dynamic-field",
    "delete-dynamic-field",
    "replace-dynamic-field",
    "add-field-type",
    "delete-field-type",
    "replace-field-type",
    "add-copy-field",
    "delete-copy-field"
].reduce ((idx, cmd) -> { idx..., [cmd]: true }), {}

schemaIndex = (schema, key) ->
    schema = schema[key] ? []
    schema.reduce ((idx, value) -> { idx..., [value.name]: value }), {}

class Schema

    constructor: (@index, @core) ->

    get: () ->
        { schema } = await @index.request @core, "schema"

        indexed =
            fieldTypes: schemaIndex schema, "fieldTypes"
            fields: schemaIndex schema, "fields"
            dynamicFields: schemaIndex schema, "dynamicFields"

        { schema..., indexed... }

    update: (commands...) ->
        transaction = for command in commands
            [name, params] = command
            throw new Error name if not SCHEMA_UPDATE_COMMANDS[name]?

            name = JSON.stringify name
            params = JSON.stringify params

            [name, params].join ":"

        transaction = transaction.join ","

        method = "POST";
        headers = { "Content-Type": "application/json;charset=UTF-8" };
        body = ["{", transaction, "}"].join ""

        @index.request { method, headers, data: body }, @core, "schema"

module.exports = (args...) -> new Index args...