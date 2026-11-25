const { connect, disconnect } = require('../config/mongo');
const DisposalRequest = require('../models/DisposalRequest');

async function removeDisposalRecord() {
  try {
    await connect();

    const requestNo = process.argv[2] || 'DR-2026-0001';
    console.log(`Searching for disposal request: ${requestNo}`);

    const doc = await DisposalRequest.findOne({
      $or: [
        { request_no: requestNo },
        { title: 'cjhbk' }
      ]
    });

    if (!doc) {
      console.log(`Disposal request ${requestNo} not found.`);
      const allDocs = await DisposalRequest.find({}, 'request_no title status unit_name');
      console.log('Current disposal requests in database:', allDocs);
      await disconnect();
      return;
    }

    console.log(`Found request: ID=${doc._id}, No=${doc.request_no}, Title="${doc.title}", Status="${doc.status}"`);

    await DisposalRequest.deleteOne({ _id: doc._id });
    console.log(`✅ Successfully deleted disposal request ${doc.request_no} from database.`);

    const remaining = await DisposalRequest.find({}, 'request_no title status');
    console.log('Remaining disposal requests in database:', remaining);

    await disconnect();
    console.log('Done.');
  } catch (err) {
    console.error('Error removing disposal request:', err);
    await disconnect().catch(() => {});
    process.exit(1);
  }
}

removeDisposalRecord();
