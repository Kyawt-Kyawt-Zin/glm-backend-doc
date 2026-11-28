import test from 'node:test';
import assert from 'node:assert/strict';
process.env.VERCEL = '1';
const {default:pool}=await import('../src/helper/db_helper.js');
const {deleteCustomerProfile}=await import('../src/repositories/user.repository.js');
let draftExists=true, deletedDrafts=false, rolledBack=false;
const connection={beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{rolledBack=true},release:()=>{},execute:async(sql)=>{
 if(sql.includes('GET_LOCK'))return [[{acquired:1}]];
 if(sql.includes('RELEASE_LOCK'))return [[{released:1}]];
 if(sql.includes('FROM users'))return [[{id:1}]];
 if(sql.includes('FROM orders'))return [[]];
 if(sql.includes('FROM preorder_checkout_drafts') && sql.startsWith('SELECT'))return [draftExists?[{id:'draft'}]:[]];
 if(sql.startsWith('DELETE FROM preorder_checkout_drafts'))deletedDrafts=true;
 return [{affectedRows:1}];
}};
pool.getConnection=async()=>connection;
test('account deletion protects pending checkout and succeeds after it is resolved',async()=>{
 assert.equal(await deleteCustomerProfile(1,'customer@example.invalid','marker','hash'),'pending_checkout');
 assert.equal(rolledBack,true);assert.equal(deletedDrafts,false);
 draftExists=false;
 assert.equal(await deleteCustomerProfile(1,'customer@example.invalid','marker','hash'),'deleted');
 assert.equal(deletedDrafts,true);
});
test.after(async()=>pool.end());
