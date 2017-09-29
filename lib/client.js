/* global require, module */

const { assign } = Object;

const request = require("superagent");

class Index {

    constructor(options = {}) {
        let { url, user, password, requestPlugins, logger } = options;

        url = (url || "http://localhost/solr/").replace(/\/+$/, "");
        requestPlugins = requestPlugins || [];

        if (logger) {
            requestPlugins.push(
                (request) => request.then(
                    (response) => {
                        logger.trace(response.toJSON());
                        return response;
                    },
                    (error) => {
                        logger.error(error, request.toJSON());
                        return Promise.reject(error);
                    }
                )
            );
        }

        assign(this, { url, user, password, requestPlugins });
    }

    status() {
        return this.send(
            this.request("GET", "admin/cores").query({ "action": "status"})
        );
    }

    core(name) {
        return new Core(this, name);
    }

    request(method, ...path) {
        const { url, user, password } = this;

        let req = request(method, [url, ...path].join("/"));

        if (user && password) {
            req = req.auth(user, password);
        }

        return req
            .set("Accept", "application/json")
            .buffer(true)
            .parse(request.parse["application/json"])
            .query({ "wt": "json" });
    }

    send(req) {
        const { requestPlugins } = this;

        return Index.checkResponseStatus(requestPlugins.reduce(
            (req, plugin) => req.use(plugin),
            req
        ));
    }

    static checkResponseStatus(req) {
        return req.then(req => {
            switch (req.body.responseHeader.status) {
            case 0:
                return req;
            default:
                return Promise.reject(req);
            }
        });
    }
}

class Core {

    constructor(index, name) {
        this.index = index;
        this.name = name;
    }

    select(query) {
        const { index, name } = this;
        return index.send(
            index.request("POST", name, "select")
                .type("application/x-www-form-urlencoded")
                .send(query)
        );
    }

    update(documents) {
        const batch = documents
                  .map(doc => doc.replace(/^<\?xml(.+?)\?>\s+/, ""))
                  .join("");

        const { index, name } = this;

        return index.send(
            index.request("POST", name, "update")
                .type("application/xml;charset=UTF-8")
                .send(["<add>", batch, "</add>"].join(""))
        );
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

        return index.send(
            index.request("GET", "admin/cores")
                .query({ "action": "SWAP" })
                .query({ core, other })
        );
    }

    command(cmd) {
        const { index, name } = this;
        return index.send(
            index.request("GET", name, "update")
                .query({ "stream.body": cmd })
        );
    }
}

module.exports = { Index, Core };