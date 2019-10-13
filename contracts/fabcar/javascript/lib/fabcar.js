/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Contract } = require('fabric-contract-api');
const { checkAssetExist, getAllAssets, editAsset, getAssetByProp, checkEnum, createAssetObj, toJSON } = require('./utils');

class fabcar extends Contract {

    async initLedger(ctx) {
        console.info('============= START : Initialize Ledger ===========');
        const cars = [
            {
                color: 'blue',
                make: 'Toyota',
                model: 'Prius',
                owner: 'OWNER1562965001',
            },
            {
                color: 'red',
                make: 'Ford',
                model: 'Mustang',
                owner: 'OWNER1562965001',
            },
            {
                color: 'green',
                make: 'Hyundai',
                model: 'Tucson',
                owner: 'OWNER1562965001',
            },
            {
                color: 'yellow',
                make: 'Volkswagen',
                model: 'Passat',
                owner: 'OWNER1562965002',
            },
            {
                color: 'black',
                make: 'Tesla',
                model: 'S',
                owner: 'OWNER1562965002',
            },
            {
                color: 'purple',
                make: 'Peugeot',
                model: '205',
                owner: 'OWNER1562965003',
            },
        ];
        const owners = [
            {
                firstName: 'Tomoko',
                lastName: 'Shotaro',
                cars: ['CAR1562965001', 'CAR1562965002', 'CAR1562965003']
            },
            {
                firstName: 'Brad',
                lastName: 'Valeria',
                cars: ['CAR1562965004', 'CAR1562965005']
            },
            {
                firstName: 'Jin Soo',
                lastName: 'Pari',
                cars: ['CAR1562965006']
            },
            {
                firstName: 'Max',
                lastName: 'Michel',
                cars: []
            }
        ];

        for (let i = 0; i < cars.length; i++) {
            cars[i].docType = 'car';
            await ctx.stub.putState('CAR156296500' + (i+1), Buffer.from(JSON.stringify(cars[i])));
            console.info('Added <--> ', 'CAR156296500' + (i+1), ' : ', cars[i]);
        }
        for (let i = 0; i < owners.length; i++) {
            owners[i].docType = 'owner';
            await ctx.stub.putState('OWNER156296500' + (i+1), Buffer.from(JSON.stringify(owners[i])));
            console.info('Added <--> ', 'OWNER156296500' + (i+1), ' : ', owners[i]);
        }
        console.info('============= END : Initialize Ledger ===========');
    }
    async changeCarOwner(ctx, txObj) {
        console.info('============= START : changeCarOwner ===========');
        let txSchema = {
            name: 'changeCarOwner',
            properties: [{
                name: 'carNumber',
                type: 'asset',
                required: 'true'
            }, {
                name: 'newOwner',
                type: 'asset',
                required: 'true'
            }, {
                name: 'firstOwner',
                type: 'asset',
                required: 'true'
            }]
        }
        await createAssetObj(ctx, JSON.stringify(txSchema), txObj);
        txObj = JSON.parse(txObj);

        let car = await checkAssetExist(ctx, txObj.carNumber, 'CAR');
        let firstOwnerObj = await checkAssetExist(ctx, txObj.firstOwner, 'OWNER');
        let newOwnerObj = await checkAssetExist(ctx, txObj.newOwner, 'OWNER');

        let flag = true;

        for (let i = 0; i < firstOwnerObj.cars.length; i++) {
            if(firstOwnerObj.cars[i] === txObj.carNumber){
                flag = false;
                firstOwnerObj.cars.splice(i, 1);
            }
        }

        if(flag){
            throw new Error(`owner ${txObj.firstOwner} is not the owner of ${txObj.carNumber}`);
        }

        newOwnerObj.cars.push(txObj.carNumber);
        car.owner = txObj.newOwner;

        await ctx.stub.putState(txObj.carNumber, Buffer.from(JSON.stringify(car)));
        await ctx.stub.putState(txObj.firstOwner, Buffer.from(JSON.stringify(firstOwnerObj)));
        await ctx.stub.putState(txObj.newOwner, Buffer.from(JSON.stringify(newOwnerObj)));
        console.info('============= END : changeCarOwner ===========');
        return JSON.stringify({key: txObj.carNumber, car: car});
    }
    async createAsset(ctx, schema, userInput) {
        createAssetObj(ctx, schema, userInput);
        schema = toJSON(schema);
        userInput = toJSON(userInput);
        let newkey = schema.name.toUpperCase() + ctx.stub.getTxTimestamp().seconds.low.toString() ;
        await ctx.stub.putState(newkey, Buffer.from(JSON.stringify(userInput)));
        return JSON.stringify({
            key: newkey,
            asset: userInput
        });
    }
    async queryAllAsset(ctx, asset) {
        return JSON.stringify(await getAllAssets(ctx, asset));
    }
    async queryAsset(ctx, key, assetName) {
        if (!assetName || assetName === 0) {
            assetName = 'asset';
    }
        return await checkAssetExist(ctx, key, assetName);
    }
    async updateAsset(ctx, key, newProparties){
        let asset = await editAsset(ctx, key, newProparties);
        return JSON.stringify({key: key, asset});
    }
    async deleteAsset(ctx, key, assetName){
        if(!assetName){
            assetName = 'asset';
    }
        await checkAssetExist(ctx, key, assetName);
        await ctx.stub.deleteState(key);
        return JSON.stringify(key);
    }
    async queryAssetByProp(ctx, propType, propValue){
        return JSON.stringify(await getAssetByProp(ctx, propType, propValue));
    }

}

module.exports = fabcar;
