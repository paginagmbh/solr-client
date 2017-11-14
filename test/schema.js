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
            ["add-field-type", {
                "name": "text_jm",
                "class": "solr.TextField",
                "positionIncrementGap": "100",
                "analyzer": {
                    "tokenizer": {
                        "class": "solr.WhitespaceTokenizerFactory"
                    },
                    "filters": [
                        { "class": "solr.LowerCaseFilterFactory" }
                    ]
                }
            }],
            ["add-dynamic-field", {
                "name": "*_txt_jm",
                "type": "text_jm",
                "indexed": true,
                "stored": true
            }],
            ["add-field-type", {
                "name": "date_range",
                "class": "solr.DateRangeField"
            }],
            ["add-dynamic-field", {
                "name": "*_dr",
                "type": "date_range",
                "indexed": true,
                "stored": true
            }]
        ).should.eventually.be.an("object");
    });
});