require("./init");

const { createLogger } = require("bunyan");
const { Index } = require("../lib/client");

const { env } = process;

const logger = createLogger({
    name: "solr-client",
    level: env.SOLR_LOG_LEVEL || "info"
});

const url = env.SOLR_URL;
const coreName = env.SOLR_CORE || "test";

const core = new Index({ url, logger }).core(coreName);

describe("schemes", function() {
    it("can be retrieved", () => {
        core.schema().get().should.eventually.be.an("object");
    });

    it("can be updated", () => {
        core.schema().update(
            ["add-field", {
                name: "test1",
                type: "currency",
                stored: true
            }],

            ["add-field", {
                name: "test2",
                type: "currency",
                stored: false
            }]

        ).should.eventually.be.an("object");
    });
});