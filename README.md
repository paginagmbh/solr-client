# ECMAScript Client for [Apache Solr](http://lucene.apache.org/solr/)

## API ##
This library provides two entry points, one for querying and one for loading data into a solr core.

### solr-client ###

```
const solr = require("solr-client");
const index = solr({url: "URL to the Solr instance that I want to address..."});
const core = index("Name of the core that I want to address");
let results = core.select{ queryOptions }
```

The `queryOptions` parameter is expecting a ECMAScript object with keys corresponding to the parameters that your Solr query parser understands, e.g.

```
let queryOptions = {
    q: "Tübingen",
    df: "full_text",
    start: 0,
    rows: 10
}
```

The select function returns an object with the keys `responseHeader` and `response`.

### solr-loader ###
solr-loader is a tool intended for command line usage. It can be called with the following parameters:

The basic call syntax is
```
solr-loader URL SOURCEGLOB
```

A number of optional parameters can be used:

```
solr-loader --clear --batch 50 --core CORENAME --swap SWAPCORENAME --schema JSONSCHEMA --encoding ENCODING --optimize URL SOURCEGLOB
```

If a swap parameter is given, data is first loaded into the core and once all data is processed, the core and swapcore are swapped. The default encoding is "utf-8", the default batch size 1.

## License

BSD

## Author Information

This library was created in 2018 by [Pagina GmbH](https://www.pagina.gmbh/).
