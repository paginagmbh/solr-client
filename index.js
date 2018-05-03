import { URL } from "url";
import request from "request";
import netrc from "netrc";

function netrcCredentials(url) {
    const { host } = new URL(url);
    const { login, password } = netrc()[host] || {};
    return { user: login, password };
}

const defaultOptions = {
    qs: {},
    useQueryString: true
};

class Index {

    constructor(options={}) {
        let url = options.url || "http://localhost/solr/";
        let { user, password } = {
            ...netrcCredentials(url),
            ...options
        };

        url = url.replace(/\/+$/, "");

        Object.assign(this, { url, user, pass: password });
    }

    async request(...args) {
        let [ options, ...path ] = args;
        if (typeof options === "string") {
            path.unshift(options);
            options = {};
        }

        let { url, user, pass } = this;
        url = [url, ...path].join("/");

        const auth = (user && pass)
              ? { user, pass, sendImmediately: true }
              : undefined;

        options = { url, auth, ...defaultOptions, ...options };

        const { qs } = options;
        Object.assign(qs, { wt: "json" });

        const res = JSON.parse(await new Promise((resolve, reject) => request(
            options, (err, res, body) => err ? reject(err) : resolve(body)
        )));

        if (res.responseHeader.status != 0) {
            throw res;
        }

        return res;
    }

    status() {
        return this.request({ qs: { "action": "status" } }, "admin", "cores");
    }

    core(name) {
        return new Core(this, name);
    }
}

class Core {

    constructor(index, name) {
        this.index = index;
        this.name = name;
    }

    schema() {
        return new Schema(this.index, this.name);
    }


    select(form) {
        const { index, name } = this;
        return index.request({ method: "POST", form }, name, "select");
    }

    command(body) {
        const { index, name } = this;
        const headers = { "Content-Type": "application/xml;charset=UTF-8" };
        return index.request({ method: "POST", headers, body }, name, "update");
    }

    update(documents) {
        return this.command([
            "<add>",
            documents
                .map(doc => doc.replace(/^<\?xml(.+?)\?>\s*/, ""))
                .join(""),
            "</add>"
        ].join(""));
    }

    clear() {
        return this.command("<delete><query>*:*</query></delete>");
    }

    commit() {
        return this.command("<commit/>");
    }

    optimize() {
        return this.command("<optimize/>");
    }

    swap(other) {
        const { index, name } = this;
        const core = name;
        const qs = { action: "SWAP", core, other };

        return index.request({ qs }, "admin", "cores");
    }

}

const SCHEMA_UPDATE_COMMANDS = [
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
].reduce((idx, cmd) => ({ ...idx, [cmd]: true }), {});

class Schema {

    constructor(index, core) {
        this.index = index;
        this.core = core;
    }

    async get() {
        const { index, core } = this;
        const { schema } = await index.request(core, "schema");

        const [fieldTypes, fields, dynamicFields] = [
            "fieldTypes",
            "fields",
            "dynamicFields"
        ].map(k => (schema[k] || []).reduce(
            (idx, v) => ({ ...idx, [v.name]: v }),
            {}
        ));

        return Object.assign(schema, { fieldTypes, fields, dynamicFields });
    }

    update(...commands) {
        const { index, core } = this;

        const transaction = commands.map(command => {
            const [name, params] = command;
            if (SCHEMA_UPDATE_COMMANDS[name] === undefined) {
                throw new Error(name);
            }

            return [
                JSON.stringify(name),
                JSON.stringify(params)
            ].join(":");

        }).join(",");

        const method = "POST";
        const headers = { "Content-Type": "application/json;charset=UTF-8" };
        const body = ["{", transaction, "}"].join("");

        return index.request({ method, headers, body }, core, "schema");
    }
}

export default (...args) => new Index(...args);