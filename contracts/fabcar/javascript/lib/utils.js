'use strict';

async function checkAssetExist(ctx, assetKey, assetName) {
    console.info('inside the checkAssetExist function and the assetkey is: ', assetKey, ' and the assetName is: ', assetName);
    const assetAsBytes = await ctx.stub.getState(assetKey);
    if (!assetAsBytes || assetAsBytes.length === 0) {
        throw new Error(`${assetName}: ${assetKey} does not exist`);
    }
    console.info('the end of the checkAssetFunction and the asset is: ', JSON.parse(assetAsBytes.toString()));
    return (JSON.parse(assetAsBytes.toString()));
}

async function getAllAssets(ctx, asset) {
    console.info('inside the getAllAssets function and the asset input is: ', asset);
    const startKey = asset.toUpperCase() + '0';
    const endKey = asset.toUpperCase() + '999999999999';

    console.info('start key and end key are: ', startKey, ' ', endKey);
    const iterator = await ctx.stub.getStateByRange(startKey, endKey);

    // console.info('the iterator is: ', iterator);

    const allResults = [];
    while (true) {
        const res = await iterator.next();

        if (res.value && res.value.value.toString()) {
            console.info(res.value.value.toString('utf8'));

            const Key = res.value.key;
            let Record;
            try {
                Record = JSON.parse(res.value.value.toString('utf8'));
            } catch (err) {
                console.log(err);
                Record = res.value.value.toString('utf8');
            }
            allResults.push({
                Key,
                Record
            });
        }
        if (res.done) {
            console.log('end of data');
            await iterator.close();
            // console.info(allResults);
            return allResults;
        }
    }
}

async function editAsset(ctx, key, newProparties) {
    const asset = await checkAssetExist(ctx, key, 'asset');

    let errorFlag = true;

    try {
        newProparties = JSON.parse(newProparties);
    } catch (error) {
        throw new Error(`error ${error} parsing newProparties ${newProparties} to JSON, please enter right format`);
    }

    const newEntries = Object.entries(newProparties);
    if (!newEntries || newEntries.length === 0) {
        throw new Error('new proparties must have at least one argument');
    }
    const keys = Object.keys(asset);

    for (const [newKey, newValue] of newEntries) {
        for (const subKey of keys) {
            if (subKey === newKey) {
                asset[subKey] = newValue;
                errorFlag = false;
            }
        }
        if (errorFlag) {
            throw new Error(`error in update asset: ${key}, key: ${newKey} is not a property of the assset!`);
        }
        errorFlag = true;
    }
    await ctx.stub.putState(key, Buffer.from(JSON.stringify(asset)));
    return asset;
}

async function getAssetByProp(ctx, propType, propValue) {

    let selector = `{"selector":{"${propType}":"${propValue}"}}`;
    console.info(selector);
    const iterator = await ctx.stub.getQueryResult(selector);
    const allResults = [];
    while (true) {
        const res = await iterator.next();

        if (res.value && res.value.value.toString()) {
            console.log(res.value.value.toString('utf8'));

            const Key = res.value.key;
            let Record;
            try {
                Record = JSON.parse(res.value.value.toString('utf8'));
            } catch (err) {
                console.log(err);
                Record = res.value.value.toString('utf8');
            }
            allResults.push({
                Key,
                Record
            });
        }
        if (res.done) {
            console.log('end of data');
            await iterator.close();
            console.info(allResults);
            if (!propType || !propValue) {
                return allResults.length;
            } else {
                return allResults;
            }
        }
    }
}

function checkEnum(str, Enum) {
    const values = Object.values(Enum);
    let flag = true;
    for (const value of values) {
        if (str === value) {
            flag = false;
        }
    }
    if (flag) {
        throw new Error(`${str} is not in the enum ${values} please enter right format`);
    }
    return str;
}

function createAssetObj(ctx, schema, userInput) {

    schema = toJSON(schema);
    userInput = toJSON(userInput);

    propCheck(schema, userInput);
    let checkFlag;

    // validate user input with schema
    for (let key in Object.keys(schema.properties)) {

        isEmpty(userInput, schema.properties[Object.keys(schema.properties)[key]]['name']) ? checkFlag = false : checkFlag = true;

        // check required fields
        if (schema.properties[Object.keys(schema.properties)[key]]['required'] == "true") {
            isEmpty(userInput, schema.properties[Object.keys(schema.properties)[key]]['name'],
                `field ${schema.properties[Object.keys(schema.properties)[key]]['name']} is a required field in ${schema.name}`);
        }

        // check types
        if (checkFlag) {
            switch (schema.properties[Object.keys(schema.properties)[key]]['type']) {
                case 'number':
                    isNumber(userInput[schema.properties[Object.keys(schema.properties)[key]]['name']],
                        `field ${schema.properties[Object.keys(schema.properties)[key]]['name']} must be a number in ${schema.name}!`);
                    break;

                case 'boolean':
                    isBoolean(userInput[schema.properties[Object.keys(schema.properties)[key]]['name']],
                        `field ${schema.properties[Object.keys(schema.properties)[key]]['name']} must be boolean in ${schema.name} !`);
                    break;

                case 'array':
                    isArray(userInput[schema.properties[Object.keys(schema.properties)[key]]['name']],
                        `field ${schema.properties[Object.keys(schema.properties)[key]]['name']} must be array in ${schema.name} !`);
                    break;

                case 'asset':
                    checkAssetExist(ctx, userInput[schema.properties[Object.keys(schema.properties)[key]]['name']], schema.properties[Object.keys(schema.properties)[key]]['name']);
                    break;

                default:
                    // console.log('default--->', userInput[Object.keys(schema.properties)[key]]);
                    break;
            }
        }
    }
    return userInput;
}

function propCheck(schema, userInput) {
    let subArr = Object.keys(userInput);
    let arr = [];
    for (let i = 0; i < schema.properties.length; i++) {
        arr.push(schema.properties[i]['name']);
    }
    for (let i = 0; i < subArr.length; i++) {
        if (!arr.includes(subArr[i])) {
            throw new Error(`property ${subArr[i]} is not a property of the asset ${schema['name']}`);
        }
    }
    console.log('passed property check...');
}

function isEmpty(object, property, errMsg) {
    if (!object[property] || object[property] == "" || object[property] === undefined || object[property].length == 0) {
        throwErr(errMsg);
        return true;
    }
    return false;
}

function toJSON(object) {
    try {
        return JSON.parse(object);
    } catch (error) {
        throw new Error(`can't parse object ${object} to JSON!`).message;
    }
}

function isNumber(str, errMsg) {
    if (!isNaN(str)) {
        return true;
    } else {
        throwErr(errMsg);
        return false;
    }
}

function isBoolean(str, errMsg) {
    if (str === 'true' || str === 'false') {
        return true;
    } else {
        throwErr(errMsg);
        return false
    }
}

function isArray(arr, errMsg) {
    if (Array.isArray(arr)) {
        return true;
    } else {
        throwErr(errMsg);
        return false;
    }
}

function throwErr(err) {
    if (!err || err == "" || err === undefined || err == 0) {
        return;
    } else {
        throw new Error(err).message;
    }
}

module.exports = {
    checkAssetExist,
    getAllAssets,
    editAsset,
    getAssetByProp,
    checkEnum,
    createAssetObj,
    toJSON
};