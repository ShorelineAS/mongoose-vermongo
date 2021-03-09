import { assert } from 'chai';
import 'mocha';
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as mongoose from 'mongoose';
import vermongo = require('../src/index');

let mongoServer;
let pageSchema = new mongoose.Schema({
  title : { type : String, required : true},
  content : { type : String, required : true },
  path : { type : String, required : true},
  tags : [String],
  lastModified : Date,
  created : Date,
  companyId: mongoose.Schema.Types.ObjectId
});

interface IPage extends mongoose.Document {
  title: string,
  content: string,
  path: string,
  tages: string[],
  lastModified?: number,
  created?: number,
  companyId?: mongoose.Types.ObjectId,
  _changedAt?: Date,
  _changedBy?: mongoose.Types.ObjectId
}

let pageVermongoSchema = new mongoose.Schema({
  _id: {
    _id: { type: mongoose.Schema.Types.ObjectId, required: true },
    _version: { type: Number, required: true }
  },
  _version: { type: Number, required: true },
  title : String,
  content : String,
  path : String,
  tags : [String],
  lastModified : Date,
  created : Date,
  _changedAt: Date,
  _changedBy: mongoose.Schema.Types.ObjectId,
  companyId: mongoose.Schema.Types.ObjectId,
});

interface IPageVermongo extends mongoose.Document {
  _id: {
    _id: mongoose.Types.ObjectId,
    _version: number
  },
  _version: number,
  title?: string,
  content?: string,
  path?: string,
  tages?: string[],
  lastModified?: number,
  created?: number,
  _changedAt: Date,
  _changedBy?: mongoose.Schema.Types.ObjectId,
  companyId?: mongoose.Schema.Types.ObjectId,
}

// Test suite
describe('vermongo tests', () => {
  let Page: mongoose.Model<IPage>;
  let PageVermongo: mongoose.Model<IPageVermongo>;

  // Connect to mongodb before running tests
  before(async () => {
    pageSchema.plugin(vermongo, 'pageschemas.vermongo');
    Page = mongoose.model<IPage>('pageschema', pageSchema);
    PageVermongo = mongoose.model<IPageVermongo>('pageschemas.vermongo');

    mongoServer = new MongoMemoryServer();
    const mongoUri = await mongoServer.getUri();
    await mongoose.connect(mongoUri, {});
  })

  it('creating an entry should not create a vermongo entry', (done) => {
    let page = new Page({ title: "test", content: "foobar", path: "lala", tags: ["a", "b"] });
    page.save()
      .then(()=> {
        return PageVermongo.find({});
      })
      .then((result) => {
        assert(result.length === 0, "not expecting a vermongo entry on first create");
        done();
      })
      .catch((e) => {
        done(e);
      })
  });

  it('updating an entry should create a vermongo entry', (done) => {
    let pageID: mongoose.Types.ObjectId;
    let changedId = mongoose.Types.ObjectId();
    let companyId = mongoose.Types.ObjectId();
    let page = new Page({ title: "foo", content: "bar", path: "baz", tags: ["a", "b", "c"], companyId });

    page.save()
      .then((page) => {
        pageID = page._id;
        page.title = "foo 2";
        return page.save();
      })
      .then(()=> {
        return PageVermongo.find({});
      })
      .then((result) => {
        assert(result.length === 1, "expecting a vermongo entry on update");
        assert(result[0].title === "foo", "expecting a vermongo entry on update");
        assert(result[0].content === "bar", "expecting a vermongo entry on update");
        assert(result[0].path === "baz", "expecting a vermongo entry on update");
        assert(result[0]._changedAt, "expecting a vermongo entry on update");
        assert(!result[0]._changedBy, "expecting a vermongo entry to not have _changedBy field");
        assert(result[0].companyId.toString() === companyId.toString(), "expecting a vermongo entry to have companyId field");
        assert(result[0]._version === 1, "expecting a vermongo entry on update");
        assert(result[0]._id._version === 1, "expecting a vermongo entry on update");
        assert(pageID.equals(result[0]._id._id), "expecting a vermongo entry on update");
      })
      .then(() => {
        return Page.findOne({});
      })
      .then((page) => {
        page._changedBy = changedId;
        return page.save();
      })
      .then(()=> {
        return PageVermongo.find({});
      })
      .then((result) => {
        assert(result.length === 2, "expecting a vermongo entry on update");
        assert(!result[0]._changedBy, "expecting a vermongo entry to not have _changedBy field");
        assert(result[1]._changedBy.toString() === changedId.toString(), "expecting a vermongo entry to have _changedBy field");
      })
      .then(async () => {
        const pages = await Page.find({});
        for (const page of pages) {
          page._changedBy = changedId;
          await page.remove();
        }
      })
      .then(()=> {
        return PageVermongo.find({});
      })
      .then((result) => {
        assert(result.length === 6, "expecting a vermongo entry on delete");
        assert(result[3]._version === -1, "expecting a vermongo entry to have -1 version");
        assert(!result[3].companyId, "expecting a vermongo entry to not have companyId");
        assert(result[3]._changedBy.toString() === changedId.toString(), "expecting a vermongo entry to have _changedBy");
        assert(result[5]._version === -1, "expecting a vermongo entry to have -1 version");
        assert(result[5].companyId.toString() === companyId.toString(), "expecting a vermongo entry to not have companyId");
        assert(result[5]._changedBy.toString() === changedId.toString(), "expecting a vermongo entry to have _changedBy");
        done();
      })
      .catch((e) => {
        done(e);
      })
  });

  // Not particularly useful for travis but important for local dev
  after(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  })

});
