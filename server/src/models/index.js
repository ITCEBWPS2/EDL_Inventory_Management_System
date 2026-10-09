const Profile = require('./Profile');
const Unit = require('./Unit');
const UserUnit = require('./UserUnit');
const Category = require('./Category');
const InventoryItem = require('./InventoryItem');
const ReceivedTransaction = require('./ReceivedTransaction');
const ExpendedTransaction = require('./ExpendedTransaction');
const Verification = require('./Verification');
const VerificationItem = require('./VerificationItem');
const IssuedDestroyedItem = require('./IssuedDestroyedItem');
const SerialCounter = require('./SerialCounter');

/**
 * Strips MongoDB _id and __v from objects or arrays of objects.
 */
function stripMongo(doc) {
  if (!doc) return null;
  if (Array.isArray(doc)) return doc.map(stripMongo);
  let obj = doc;
  if (typeof doc.toObject === 'function') {
    obj = doc.toObject();
  } else if (typeof doc === 'object') {
    obj = { ...doc };
  }
  delete obj._id;
  delete obj.__v;
  return obj;
}

module.exports = {
  Profile,
  Unit,
  UserUnit,
  Category,
  InventoryItem,
  ReceivedTransaction,
  ExpendedTransaction,
  Verification,
  VerificationItem,
  IssuedDestroyedItem,
  SerialCounter,
  stripMongo
};
