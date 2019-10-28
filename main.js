const Helpers = require('./helpers.js');

console.log('uncomment each part separately to test it, then integrate it with your server');

// // teardown network
// Helpers.teardownNetwork(() => {
//     // start network
//     Helpers.startNetwork(() => {
//         // deploy contract
//         Helpers.deployContract(() => {
//             console.log('done');
//             return;
//         }, (err) => {
//             console.log(err);
//         });
//         return;
//     }, (err) => {
//         console.log('err starting network', err);
//     });
//     return;
// }, (err) => {
//     console.log('err stoping network', err);
// });

// // upgrade contract
// Helpers.upgradeContract('2.0', () => {
//     console.log('done');
//     return;
// }, (err) => {
//     console.log(err);
// });

//  // query all cars test
// Helpers.queryAllAsset('car')
// .then(cars => console.log(cars))
// .catch(err =>  console.log(err))

// Helpers.transactionExcute(['submit', 'changeCarColor', JSON.stringify({carNumber: 'CAR1562965005', newColor: 'new color'})])
// .then(cars => console.log(cars))
// .catch(err =>  console.log(err))
