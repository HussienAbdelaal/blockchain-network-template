'use strict';

const spawn = require('child_process').spawn;
const fs = require('fs');
const path = require('path');
const FabricCAServices = require('fabric-ca-client');
const { FileSystemWallet, Gateway, X509WalletMixin} = require('fabric-network');
let ccName = 'fabcar';

const helper = {
  executeCmd: async (cmd, resolve, reject) => {
    console.log('cmd is: ', cmd);
    let cmdOutput;
    const process = spawn(cmd, {
      shell: true
    });

    process.stdout.setEncoding('utf-8');
    process.stdout.on('data', function (data) {
      console.log('STDOUT: ', data);
      cmdOutput = data;
    });

    process.stderr.setEncoding('utf-8');
    process.stderr.on('data', function (data) {
      console.log('STDERR: ', data);
      cmdOutput = data;
    });

    process.on('exit', function (exitCode) {
      if (exitCode !== 0) {
        console.error('error running command!');
        return reject({
          msg: 'error running command!',
          cmdOutput: cmdOutput
        });
      }
      console.log('Child exited with code: ' + exitCode);
      return resolve({
        msg: 'success',
        cmdOutput: cmdOutput
      });
    });
  },
  startNetwork: async (resolve, reject) => {
    let networkPath = path.join(__dirname, './networks/networkTemplate');
    helper.executeCmd(`
    cd ${networkPath} &&
    echo y | ./byfn.sh up -n -a`, () => {
      helper.enrollAdmin('admin', 'adminpw', () => {
        helper.registerUser('admin', 'user0', () => {
          return resolve(`network started successfully and created admin and user wallets`);
        }, (error) => {
          return reject(`network start error: ${error.msg}`);
        })
      }, (error) => {
        return reject(`network start error: ${error.msg}`);
      })
    }, (error) => {
      return reject(`network start error: ${error.msg}`);
    })
  },
  teardownNetwork: async (resolve, reject) => {
    let networkPath = path.join(__dirname, './networks/networkTemplate');
    helper.executeCmd(`cd ${networkPath} && pwd && echo y | ./byfn.sh down && (rm wallet/ -r || echo "couldnt findwallet to remove")`, () => {
      return resolve('network teardown successfully');
    }, (error) => {
      return reject(`network teardown error: ${error.msg}`);
    })
  },
  deployContract: (resolve, reject) => {
    let networkPath = path.join(__dirname, './networks/networkTemplate');
    helper.executeCmd(`cd ${networkPath} && ./runCC.sh ${ccName} && docker ps`, () => {
      return resolve('run contract successful');
    }, (error) => {
      return reject('run contract error: ', error.msg);
    });
  },
  createAsset: async (assetObject, values) =>
    await helper.transactionExcute(['submit', 'createAsset', JSON.stringify(assetObject), JSON.stringify(values)]),
  queryAllAsset: async asset =>
    await helper.transactionExcute(['evaluate', 'queryAllAsset', asset]),
  queryAsset: async key =>
    await helper.transactionExcute(['evaluate', 'queryAsset', key]),
  queryAssetByProp: async (propType, propValue) =>
    await helper.transactionExcute(['evaluate', 'queryAssetByProp', propType, propValue]),
  updateAsset: async (key, newProperties) =>
    await helper.transactionExcute(['submit', 'updateAsset', key,
      JSON.stringify(newProperties)
    ]),
  deleteAsset: async key =>
    await helper.transactionExcute(['submit', 'deleteAsset', key]),
  enrollAdmin: async (admin, adminSecret, resolve, reject) => {
    const ccpPath = path.join(__dirname, './networks/networkTemplate','connection-org1.json');
    const ccpJSON = fs.readFileSync(ccpPath, 'utf8');
    const ccp = JSON.parse(ccpJSON);
    try {
      // Create a new CA client for interacting with the CA.
      const caInfo = ccp.certificateAuthorities[`ca.org1.example.com`];
      const caTLSCACertsPath = path.resolve(__dirname, './networks/networkTemplate', caInfo.tlsCACerts.path);
      const caTLSCACerts = fs.readFileSync(caTLSCACertsPath);
      const ca = new FabricCAServices(
        caInfo.url, {
          trustedRoots: caTLSCACerts,
          verify: false
        },
        caInfo.caName
      );

      const walletPath = path.join(__dirname, './networks/networkTemplate', 'wallet');
      const wallet = new FileSystemWallet(walletPath);
      console.log(`Wallet path: ${walletPath}`);
      const adminExists = await wallet.exists(admin);
      if (adminExists) {
        console.log(`An identity for the admin user ${admin} already exists in the wallet`);
        return reject(new Error(`An identity for the admin user ${admin} already exists in the wallet`));
      }
      const enrollment = await ca.enroll({
        enrollmentID: admin,
        enrollmentSecret: adminSecret
      });
      const identity = X509WalletMixin.createIdentity(
        'Org1MSP',
        enrollment.certificate,
        enrollment.key.toBytes()
      );
      await wallet.import(admin, identity);
      console.log(`Successfully enrolled admin user ${admin} and imported it into the wallet`);
      return resolve(`Successfully enrolled admin user ${admin} and imported it into the wallet`);
    } catch (error) {
      console.error('Failed to enroll admin user ' + admin + `: ${error}`);
      return reject(new Error('Failed to enroll admin user ' + admin + `: ${error}`));
    }
  },
  registerUser: async (admin, appUser, resolve, reject) => {
    const ccpPath = path.join(__dirname, './networks/networkTemplate', 'connection-org1.json');
    try {
      const walletPath = path.join(__dirname, './networks/networkTemplate', 'wallet');
      const wallet = new FileSystemWallet(walletPath);
      console.log(`Wallet path: ${walletPath}`);
      const userExists = await wallet.exists(appUser);
      if (userExists) {
        console.log(`An identity for the user ${appUser} already exists in the wallet`);
        return reject(new Error(`An identity for the user ${appUser} already exists in the wallet`));
      }
      const adminExists = await wallet.exists(admin);
      if (!adminExists) {
        console.log(`An identity for the admin user ${admin} does not exist in the wallet`);
        console.log('Run the enrollAdmin.js application before retrying');
        return reject('Run the enrollAdmin.js application before retrying');
      }
      const gateway = new Gateway();
      await gateway.connect(ccpPath, {
        wallet,
        identity: admin,
        discovery: {
          enabled: true,
          asLocalhost: true
        }
      });
      const ca = gateway.getClient().getCertificateAuthority();
      const adminIdentity = gateway.getCurrentIdentity();
      const secret = await ca.register({
          affiliation: 'org1.department1',
          enrollmentID: appUser,
          role: 'client'
        },
        adminIdentity
      );
      const enrollment = await ca.enroll({
        enrollmentID: appUser,
        enrollmentSecret: secret
      });
      const userIdentity = X509WalletMixin.createIdentity(
        'Org1MSP',
        enrollment.certificate,
        enrollment.key.toBytes()
      );
      await wallet.import(appUser, userIdentity);
      console.log(`Successfully registered and enrolled admin user ${appUser} and imported it into the wallet`);
      return resolve(`Successfully registered and enrolled admin user ${appUser} and imported it into the wallet`);
    } catch (error) {
      return reject( new Error(`Failed to register user  ${appUser} : ${error}`));
    }
  },
  transactionExcute: async argArray => {
    const ccpPath = path.join(__dirname, './networks/networkTemplate', 'connection-org1.json');
    try {
      const walletPath = path.resolve(__dirname, './networks/networkTemplate', 'wallet');
      const wallet = new FileSystemWallet(walletPath);
      console.log(`Wallet path: ${walletPath}`);

      const userExists = await wallet.exists('user0');
      if (!userExists) {
        console.log(
          `An identity for the user 'user0' does not exist in the wallet`
        );
        console.log('Run the registerUser.js application before retrying');
        return new Error('Run the registerUser.js application before retrying');
      }
      const gateway = new Gateway();
      await gateway.connect(ccpPath, {
        wallet,
        identity: 'user0',
          discovery: {
            enabled: true,
            asLocalhost: true
          }
        });

      const network = await gateway.getNetwork('mychannel');

      const contract = network.getContract(ccName);

      console.log('transaction inputs ===> ', argArray);
      let result;

      if (argArray[0] === 'submit') {
        // Submit the specified transaction.
        result = await contract.submitTransaction(...argArray.slice(1));
        console.log('Transaction has been submitted');
        try {
          result = JSON.parse(JSON.parse(JSON.parse(result)));
        } catch (error) {
          try {
            result = JSON.parse(JSON.parse(result));
          } catch (error) {
            try {
              result = JSON.parse(result);
            } catch (error) {}
          }
        }
      } else if (argArray[0] === 'evaluate') {
        // evaluate the specified transaction.
        result = await contract.evaluateTransaction(...argArray.slice(1));
        console.log('Query evaluation has been done successfully!');
        try {
          result = JSON.parse(JSON.parse(JSON.parse(result)));
        } catch (error) {
          try {
            result = JSON.parse(JSON.parse(result));
          } catch (error) {
            try {
              result = JSON.parse(result);
            } catch (error) {}
          }
        }
      } else {
        console.log('Failed to excute transaction: first argument of array must be "submit" or "evaluate"');
        return new Error('Failed to excute transaction: first argument of array must be "submit" or "evaluate"! ', error);
      }

      await gateway.disconnect();

      return result;
    } catch (error) {
      console.error(`Failed to excute transaction: ${error}`);
      throw error;
    }
  },
  getBlockHeight: async () => {
    const ccpPath = path.join(__dirname, './networks/networkTemplate', 'connection-org1.json');
    try {
      const walletPath = path.resolve(__dirname, './networks/networkTemplate', 'wallet');
      const wallet = new FileSystemWallet(walletPath);
      console.log(`Wallet path: ${walletPath}`);

      const userExists = await wallet.exists('user0');
      if (!userExists) {
        console.log(
          `An identity for the user 'user0' does not exist in the wallet`
        );
        console.log('Run the registerUser.js application before retrying');
        return new Error('Run the registerUser.js application before retrying');
      }
      const gateway = new Gateway();
      await gateway.connect(ccpPath, {
        wallet,
        identity: 'user0',
          discovery: {
            enabled: true,
            asLocalhost: true
          }
        });

      const network = await gateway.getNetwork('mychannel');

      const blocks = await network.getChannel().queryInfo();

      await gateway.disconnect();

      return blocks.height.low;
    } catch (error) {
      console.error(`Failed to excute transaction: ${error}`);
      throw error;
    }
  },
  getBlockData: async blockNumber => {
    const ccpPath = path.join(
      __dirname,
      './networks/networkTemplate',
      'connection-org1.json'
    );
    try {
      const walletPath = path.resolve(
        __dirname,
        './networks/networkTemplate',
        'wallet'
      );
      const wallet = new FileSystemWallet(walletPath);
      console.log(`Wallet path: ${walletPath}`);

      const userExists = await wallet.exists('user0');
      if (!userExists) {
        console.log(
          `An identity for the user 'user0' does not exist in the wallet`
        );
        console.log('Run the registerUser.js application before retrying');
        return new Error('Run the registerUser.js application before retrying');
      }
      const gateway = new Gateway();
      await gateway.connect(ccpPath, {
        wallet,
        identity: 'user0',
          discovery: {
            enabled: true,
            asLocalhost: true
          }
        });

      const network = await gateway.getNetwork('mychannel');

      blockNumber = parseFloat(blockNumber);
      const block = await network.getChannel().queryBlock(blockNumber);

      await gateway.disconnect();
      for (let i = 0; i < 2; i++) {
        if(block.data.data[0].payload.data.actions[0].payload.action.proposal_response_payload.extension.results['ns_rwset'][i]['namespace'] !== 'lscc'){
          return block.data.data[0].payload.data.actions[0].payload.action.proposal_response_payload.extension.results['ns_rwset'][i]['rwset']['writes'][0];
        }
      }
    } catch (error) {
      console.error(`Failed to excute transaction: ${error}`);
      throw error;
    }
  },
  getAllBlockData: async () => {
    let finalBlock = await helper.getBlockHeight();
    let output = [];
    let blockData ;
    for (let i = 4; i < finalBlock; i++) {
      blockData = await helper.getBlockData(i);
      output.push(blockData);
    }
    let filtered = output.filter(function(element){
    	return element != null;
    })
    return filtered;
  }
};

module.exports = helper;
