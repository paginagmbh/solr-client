/* global module, require */

const { assign } = Object;
const { Transform } = require("stream");

const { Index } = require("./client");
const index = (options = {}) => new Index(options);

class Clear extends Transform {

    constructor(options) {
        super({ objectMode: true });
        const { core } = options;

        this.core = index(options).core(core);
        this.clear = undefined;
    }

    _transform(file, encoding, callback) {
        this.clear = this.clear || this.core.clear();
        this.clear.then(
            () => callback(undefined, file),
            (err) => callback(err)
        );
    }
}

class IdentityTransform extends Transform {

    constructor() {
        super({ objectMode: true });
    }

    _transform(file, encoding, callback) {
        callback(undefined, file);
    }

}

class SealingCoreCommand extends IdentityTransform {

    constructor(options) {
        super();

        const { core } = options;
        this.core = index(options).core(core);
    }


    _flush(callback) {
        this.seal()
            .then(() => this.push(null))
            .then(
                () => callback(),
                (err) => callback(err)
            );
    }
}

class Commit extends SealingCoreCommand {

    constructor(options) {
        super(options);
    }

    seal() {
        return this.core.commit();
    }
}

class Optimize extends SealingCoreCommand {

    constructor(options) {
        super(options);
    }

    seal() {
        return this.core.optimize();
    }
}

class Swap extends IdentityTransform {

    constructor(options) {
        super();

        const { core, other } = options;
        this.core = index(options).core(core);
        this.other = other;
    }

    _flush(callback) {
        const { core, other } = this;

        core.swap(other)
            .then(() => this.push(null))
            .then(
                () => callback(),
                (err) => callback(err)
            );
    }

}

class Update extends Transform {

    constructor(options = {}) {
        super({ objectMode: true });

        const { core, batchSize, file2Document } = options;

        this.core = index(options).core(core);
        this.batchSize = batchSize || 10;
        this.file2Document = file2Document ||
            ((file) => file.contents.toString());

        this.batch = [];
        this.pending = 0;
        this.updates = [];
    }

    _transform(file, encoding, callback) {
        this.batch.push(file);
        this.process().then(
            () => callback(),
            (err) => callback(err)
        );
    }

    _flush(callback) {
        this.process(true);

        Promise.all(this.updates)
            .then(() => this.push(null))
            .then(
                () => callback(),
                (err) => callback(err)
            );
    }

    process(force = false) {
        const { batchSize, updates, core, file2Document } = this;

        if (this.batch.length < (force ? 1 : batchSize)) {
            return Promise.resolve(this.batch);
        }

        const batch = this.batch.slice();
        this.batch = [];

        const update = Promise.all(batch.map(file => file2Document(file)))
              .then((docs) => core.update(docs))
              .then(() => batch.forEach((file) => this.push(file)));

        updates.push(update);

        return update;
    }
}

module.exports = {
    clear: (options, core) => new Clear(assign({ core }, options)),

    commit: (options, core) => new Commit(assign({ core }, options)),

    optimize: (options, core) => new Optimize(assign({ core }, options)),

    swap: (options, core, other) => new Swap(assign(
        { core, other },
        options
    )),

    update: (options, core) => new Update(assign({ core }, options))
};
