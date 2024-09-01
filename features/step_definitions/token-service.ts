import { Given, Then, When } from "@cucumber/cucumber";
import { Client, StatusError, TokenSupplyType, TransactionId, TransferTransaction } from "@hashgraph/sdk";
import assert from "node:assert";
import { accounts } from "../../src/config";
import {
  associateToken, createAccount, createToken, getAccountBalance, getTokenInfo, mintToken, retrieveAccountDetails, transferToken
} from "../../src/hedera";


const client = Client.forTestnet();


Given(/^A Hedera account with more than (\d+) hbar$/, async function (expectedBalance: number) {
  const accDetails = retrieveAccountDetails(accounts[0]);
  this.accountId = accDetails.accountId;
  this.privateKey = accDetails.privateKey;
  client.setOperator(this.accountId, this.privateKey);

  const balance = await getAccountBalance(this.accountId, client, null);
  console.log(`Balance of the account: ${balance}`);

  assert.ok(balance > expectedBalance);
});

When(/^I create a token named Test Token \(HTT\)$/, async function () {
  const { tokenId, supplyKey } = await createToken(TokenSupplyType.Infinite, 0, null, this.accountId, this.privateKey, client);
  this.tokenId = tokenId;
  this.supplyKey = supplyKey;
  console.log(`New token id: ${this.tokenId}`);
});

Then(/^The token has the name "([^"]*)"$/, async function (tokenName: string) {
  const tokenInfo = await getTokenInfo(this.tokenId, client);
  console.log(`Name of the token: ${tokenInfo.name}`);

  assert.ok(tokenName === tokenInfo.name);
});

Then(/^The token has the symbol "([^"]*)"$/, async function (tokenSymbol: string) {
  const tokenInfo = await getTokenInfo(this.tokenId, client);
  console.log(`Symbol of the token: ${tokenInfo.symbol}`);

  assert.ok(tokenSymbol === tokenInfo.symbol);
});

Then(/^The token has (\d+) decimals$/, async function (tokenDecimals: number) {
  const tokenInfo = await getTokenInfo(this.tokenId, client);
  console.log(`The token has ${tokenInfo.decimals} decimals`);

  assert.ok(tokenDecimals === tokenInfo.decimals);
});

Then(/^The token is owned by the account$/, async function () {
  const tokenInfo = await getTokenInfo(this.tokenId, client);
  console.log(`Owner of the token: ${tokenInfo.treasuryAccountId}`);

  assert.ok(this.accountId.toString() === tokenInfo.treasuryAccountId?.toString());
});

Then(/^An attempt to mint (\d+) additional tokens succeeds$/, async function (numberOfTokensToMint: number) {
  const status = await mintToken(this.tokenId, numberOfTokensToMint, this.supplyKey, client);
  console.log(`Token mint transaction status: ${status}`);

  assert.ok(status.toString() === 'SUCCESS');
});

When(/^I create a fixed supply token named Test Token \(HTT\) with (\d+) tokens$/, async function (numTokens: number) {
  const { tokenId, supplyKey } = await createToken(TokenSupplyType.Finite, numTokens, numTokens, this.accountId, this.privateKey, client);
  this.tokenId = tokenId;
  this.supplyKey = supplyKey;
  console.log(`New token id: ${this.tokenId}`);
});

Then(/^The total supply of the token is (\d+)$/, async function (totalSupply: number) {
  const tokenInfo = await getTokenInfo(this.tokenId, client);
  console.log(`Total supply of the token: ${tokenInfo.totalSupply}`);

  assert.ok(totalSupply === tokenInfo.totalSupply.toNumber());
});

Then(/^An attempt to mint tokens fails$/, async function () {
  try {
    const status = await mintToken(this.tokenId, 1, this.supplyKey, client);
    console.log(`Token mint transaction status: ${status}`);
  } catch (err) {
    console.log(`Failed to mint token: ${err}`)
    assert.ok((err as StatusError).status.toString() === 'TOKEN_MAX_SUPPLY_REACHED')
  }
});

Given(/^A first hedera account with more than (\d+) hbar$/, async function (expectedBalance: number) {
  const accDetails = retrieveAccountDetails(accounts[2]);
  this.accountId1 = accDetails.accountId;
  this.privateKey1 = accDetails.privateKey;
  console.log(`First account id: ${this.accountId1}`);

  const balance = await getAccountBalance(this.accountId1, client, null);
  console.log(`Balance of the first account: ${balance}`);

  assert.ok(balance > expectedBalance);
});

Given(/^A second Hedera account$/, async function () {
  const accDetails = retrieveAccountDetails(accounts[3]);
  this.accountId2 = accDetails.accountId;
  this.privateKey2 = accDetails.privateKey;
  console.log(`Second account id: ${this.accountId2}`);

  const balance = await getAccountBalance(this.accountId2, client, null);
  console.log(`Balance of the second account: ${balance}`);
});

Given(/^A token named Test Token \(HTT\) with (\d+) tokens$/, async function (numTokens: number) {
  const treasuryAccount = retrieveAccountDetails(accounts[0]);
  this.accountId = treasuryAccount.accountId;
  this.privateKey = treasuryAccount.privateKey;
  client.setOperator(this.accountId, this.privateKey);
  console.log(`Treasury account id: ${this.accountId}`);

  const { tokenId } = await createToken(TokenSupplyType.Finite, numTokens, numTokens, this.accountId, this.privateKey, client);
  this.tokenId = tokenId;
  console.log(`New token id: ${this.tokenId}`);
});

Given(/^The first account holds (\d+) HTT tokens$/, async function (tokenBalance: number) {
  try {
    //First associate the token with the first account if not already done
    const status = await associateToken(this.tokenId, this.accountId1, this.privateKey1, client);
    console.log(`Token association with the first account transaction status: ${status}`);

    //Transfer token from the treasury account to the first account
    const status1 = await transferToken(this.tokenId, this.accountId, this.accountId1, tokenBalance, null, this.privateKey, client);
    console.log(`Token transfer from the treasury to the first account status: ${status1}`);
  } catch (err) { }

  const balance = await getAccountBalance(this.accountId1, client, this.tokenId);
  console.log(`Token balance for the first account: ${balance}`);

  assert.ok(tokenBalance === balance);
});

Given(/^The second account holds (\d+) HTT tokens$/, async function (tokenBalance: number) {
  try {
    //First associate the token with the second account if not already done
    const status = await associateToken(this.tokenId, this.accountId2, this.privateKey2, client);
    console.log(`Token association with the second account transaction status: ${status}`);

    //Transfer token from the treasury account to the second account
    const status1 = await transferToken(this.tokenId, this.accountId, this.accountId2, tokenBalance, null, this.privateKey, client);
    console.log(`Token transfer from the treasury to the second account status: ${status1}`);
  } catch (err) { }

  const balance = await getAccountBalance(this.accountId2, client, this.tokenId);
  console.log(`Token balance for the second account: ${balance}`);

  assert.ok(tokenBalance === balance);
});

When(/^The first account creates a transaction to transfer (\d+) HTT tokens to the second account$/, async function (transferAmount: number) {
  const firstClient = Client.forTestnet().setOperator(this.accountId1, this.privateKey1);

  this.transferTransaction = await transferToken(this.tokenId, this.accountId1, this.accountId2, transferAmount, null, null, firstClient);
  console.log(`Token transfer transaction from first account to second account created`);
});

When(/^The first account submits the transaction$/, async function () {
  const firstClient = Client.forTestnet().setOperator(this.accountId1, this.privateKey1);

  this.balanceBeforeTx = await getAccountBalance(this.accountId1, client, null);

  //Sign with the first account private key and submit to the Hedera network
  const transferRx = await (await this.transferTransaction.sign(this.privateKey1)).execute(firstClient);
  //Get the receipt of the transaction and retrieve the transaction status
  const receipt = await transferRx.getReceipt(firstClient);
  console.log(`Token transfer transaction status: ${receipt.status}`);

  this.balanceAfterTx = await getAccountBalance(this.accountId1, client, null);
});

When(/^The second account creates a transaction to transfer (\d+) HTT tokens to the first account$/, async function (transferAmount: number) {
  const secondClient = Client.forTestnet().setOperator(this.accountId2, this.privateKey2);

  this.transferTransaction = await transferToken(this.tokenId, this.accountId2, this.accountId1, transferAmount, TransactionId.generate(this.accountId1), this.privateKey2, secondClient);
  console.log(`Token transfer transaction from second account to first account created`);
});

Then(/^The first account has paid for the transaction fee$/, async function () {
  console.log(`Balance of first account before transaction: ${this.balanceBeforeTx}`);
  console.log(`Balance of first account after transaction: ${this.balanceAfterTx}`);

  assert.ok(this.balanceBeforeTx > this.balanceAfterTx);
});

Given(/^A first hedera account with more than (\d+) hbar and (\d+) HTT tokens$/, async function (expectedBalance: number, tokenBalance: number) {
  const accDetails = retrieveAccountDetails(accounts[2]);
  this.accountId1 = accDetails.accountId;
  this.privateKey1 = accDetails.privateKey;
  console.log(`First account id: ${this.accountId1}`);

  let balance = await getAccountBalance(this.accountId1, client, null);
  console.log(`Balance of the first account: ${balance}`);

  assert.ok(balance > expectedBalance);

  const status = await associateToken(this.tokenId, this.accountId1, this.privateKey1, client);
  console.log(`Token association with the first account transaction status: ${status}`);

  const status1 = await transferToken(this.tokenId, this.accountId, this.accountId1, tokenBalance, null, this.privateKey, client);
  console.log(`Token transfer from the treasury to the first account status: ${status1}`);

  balance = await getAccountBalance(this.accountId1, client, this.tokenId);
  console.log(`Token balance for the first account: ${balance}`);

  assert.ok(tokenBalance === balance);
});

Given(/^A second Hedera account with (\d+) hbar and (\d+) HTT tokens$/, async function (accountBalance: number, tokenBalance: number) {
  const accDetails = await createAccount(client, accountBalance);
  this.accountId2 = accDetails.accountId;
  this.privateKey2 = accDetails.privateKey;
  console.log(`Second account id: ${this.accountId2}`);

  let balance = await getAccountBalance(this.accountId2, client, null);
  console.log(`Balance of the second account: ${balance}`);

  assert.ok(balance === accountBalance);

  const status = await associateToken(this.tokenId, this.accountId2, this.privateKey2, client);
  console.log(`Token association with the second account transaction status: ${status}`);

  const status1 = await transferToken(this.tokenId, this.accountId, this.accountId2, tokenBalance, null, this.privateKey, client);
  console.log(`Token transfer from the treasury to the second account status: ${status1}`);

  balance = await getAccountBalance(this.accountId2, client, this.tokenId);
  console.log(`Token balance for the second account: ${balance}`);

  assert.ok(tokenBalance === balance);
});

Given(/^A third Hedera account with (\d+) hbar and (\d+) HTT tokens$/, async function (accountBalance: number, tokenBalance: number) {
  const accDetails = await createAccount(client, accountBalance);
  this.accountId3 = accDetails.accountId;
  this.privateKey3 = accDetails.privateKey;
  console.log(`Third account id: ${this.accountId3}`);

  let balance = await getAccountBalance(this.accountId3, client, null);
  console.log(`Balance of the third account: ${balance}`);

  assert.ok(balance === accountBalance);

  const status = await associateToken(this.tokenId, this.accountId3, this.privateKey3, client);
  console.log(`Token association with the third account transaction status: ${status}`);

  const status1 = await transferToken(this.tokenId, this.accountId, this.accountId3, tokenBalance, null, this.privateKey, client);
  console.log(`Token transfer from the treasury to the third account status: ${status1}`);

  balance = await getAccountBalance(this.accountId3, client, this.tokenId);
  console.log(`Token balance for the third account: ${balance}`);

  assert.ok(tokenBalance === balance);
});

Given(/^A fourth Hedera account with (\d+) hbar and (\d+) HTT tokens$/, async function (accountBalance: number, tokenBalance: number) {
  const accDetails = await createAccount(client, accountBalance);
  this.accountId4 = accDetails.accountId;
  this.privateKey4 = accDetails.privateKey;
  console.log(`Fourth account id: ${this.accountId4}`);

  let balance = await getAccountBalance(this.accountId4, client, null);
  console.log(`Balance of the fourth account: ${balance}`);

  assert.ok(balance === accountBalance);

  const status = await associateToken(this.tokenId, this.accountId4, this.privateKey4, client);
  console.log(`Token association with the fourth account transaction status: ${status}`);

  const status1 = await transferToken(this.tokenId, this.accountId, this.accountId4, tokenBalance, null, this.privateKey, client);
  console.log(`Token transfer from the treasury to the fourth account status: ${status1}`);

  balance = await getAccountBalance(this.accountId4, client, this.tokenId);
  console.log(`Token balance for the fourth account: ${balance}`);

  assert.ok(tokenBalance === balance);
});

When(/^A transaction is created to transfer (\d+) HTT tokens out of the first and second account and (\d+) HTT tokens into the third account and (\d+) HTT tokens into the fourth account$/, async function (trAmount1: number, trAmount3: number, trAmount4: number) {
  const secondClient = Client.forTestnet().setOperator(this.accountId1, this.privateKey1);

  //Create the transfer transaction
  this.transferTransaction = await new TransferTransaction()
    .addTokenTransfer(this.tokenId, this.accountId1, -1 * trAmount1)
    .addTokenTransfer(this.tokenId, this.accountId2, -1 * trAmount1)
    .addTokenTransfer(this.tokenId, this.accountId3, trAmount3)
    .addTokenTransfer(this.tokenId, this.accountId4, trAmount4)
    .setTransactionId(TransactionId.generate(this.accountId1))
    .freezeWith(secondClient)
    .sign(this.privateKey2);

  console.log(`Token transfer transaction from first and second accounts to third and fourth accounts created`);
});

Then(/^The third account holds (\d+) HTT tokens$/, async function (tokenBalance: number) {
  const balance = await getAccountBalance(this.accountId3, client, this.tokenId);
  console.log(`Token balance for the third account: ${balance}`);

  assert.ok(tokenBalance === balance);
});

Then(/^The fourth account holds (\d+) HTT tokens$/, async function (tokenBalance: number) {
  const balance = await getAccountBalance(this.accountId4, client, this.tokenId);
  console.log(`Token balance for the fourth account: ${balance}`);

  assert.ok(tokenBalance === balance);
});
