var Cryptopunks = {};
Cryptopunks.ABI = [
  {"constant":true,"inputs":[{"name":"","type":"uint256"}],"name":"punkIndexToAddress","outputs":[{"name":"","type":"address"}],"payable":false,"type":"function"},
  {"anonymous":false,"inputs":[{"indexed":true,"name":"from","type":"address"},{"indexed":true,"name":"to","type":"address"},{"indexed":false,"name":"punkIndex","type":"uint256"}],"name":"PunkTransfer","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"name":"punkIndex","type":"uint256"},{"indexed":false,"name":"value","type":"uint256"},{"indexed":true,"name":"fromAddress","type":"address"},{"indexed":true,"name":"toAddress","type":"address"}],"name":"PunkBought","type":"event"}
];

var Lostpunksociety = {};
Lostpunksociety.ABI = [
  {"inputs":[{"internalType":"uint16","name":"index","type":"uint16"}],"name":"punkAttributes","outputs":[{"internalType":"string","name":"text","type":"string"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint16","name":"index","type":"uint16"}],"name":"punkImageSvg","outputs":[{"internalType":"string","name":"svg","type":"string"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"ownerOf","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint16","name":"fatherIndex","type":"uint16"},{"internalType":"uint16","name":"motherIndex","type":"uint16"}],"name":"mintLostPunk","outputs":[],"stateMutability":"payable","type":"function"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"Transfer","type":"event"}
];

var BaseURLs = {};
var ConnectedWallet = {};

window.addEventListener('load', function() {
  if (window.ethereum) {
      let web3 = new Web3(ethereum);
      window.web3 = web3;
  } else if (typeof web3 !== 'undefined') {
      window.web3 = new Web3(web3.currentProvider);
  } else {
      let web3 = new Web3("https://cloudflare-eth.com");
      window.web3 = web3;
  }

  let queryString = window.location.search;
  let parameters = new URLSearchParams(queryString);
  let useTestNetwork = (parameters.get('test') === "true");

  BaseURLs.etherscan = "https://" + (useTestNetwork ? "rinkeby." : "") + "etherscan.io/tx/";
  BaseURLs.opensea = "https://" + (useTestNetwork ? "testnets." : "") + "opensea.io/assets/";
  Cryptopunks.address = useTestNetwork ? "0xD52Bf1c58aC593d8901a03432B51575a406e1082" : "0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB";
  Lostpunksociety.address = useTestNetwork ? "0x3b41aeeb7705037b866e7befae6e4ca8153c4c8a" : "0xa583bEACDF3Ed3808402f8dB4F6628a7E1C6ceC6";

  ConnectedWallet.testIDs = useTestNetwork ? [1340, 8348, 3100, 7804, 5217, 8857, 7252, 8888, 3831, 9998] : [];
  Cryptopunks.originBlock = 3914490;
  Lostpunksociety.originBlock = useTestNetwork ? 9366572 : 13339194;

  Cryptopunks.contract = new web3.eth.Contract(Cryptopunks.ABI, Cryptopunks.address);
  Lostpunksociety.contract = new web3.eth.Contract(Lostpunksociety.ABI, Lostpunksociety.address);

  addButtonEventHandlerWithKeys(document.getElementById('parentsButton'), ['Mother', 'Father']);
  addButtonEventHandlerWithKeys(document.getElementById('childrenButton'), ['Child 1', 'Child 2']);
});

var htmlElement = function(html) {
  var template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstChild;
};

var wrapSvgElement = function(svg, id, selectable) {
  var selectableAttributes = '';
  if (selectable) {
    selectableAttributes += ' id="' + id + '"';
    selectableAttributes += ' onclick="return toggleSelection(' + id + ');"';
  }
  var svg = htmlElement('<div class="punk"' + selectableAttributes + '>' + svg + '</div>');
  svg.appendChild(htmlElement('<p class="punkFooter">#' + id + '<p>'));
  return svg;
};

var drawPunks = function(punks, rootElement, selectable) {
  let placeholder = document.getElementById(rootElement + '-placeholder');
  let tree = document.getElementById(rootElement);

  let levelCount = Object.keys(punks).length;
  for (var level = 0; level < levelCount; ++level) {
    if (level > 0) {
      tree.appendChild(htmlElement('<br/>'));
    }
    punks[level].forEach(punk => {
      tree.appendChild(wrapSvgElement(punk['svg'], punk['id'], selectable));
    });
  }

  placeholder.hidden = true;
  tree.hidden = false;
};

var toggleSelection = function(punkID, suppressUIUpdate) {
  let element = document.getElementById(punkID);
  let wasSelected = (element.className === 'punkSelected');
  element.className = wasSelected ? 'punk' : 'punkSelected';
  if (wasSelected) {
    if (punkID == ConnectedWallet.firstParentID) {
      ConnectedWallet.firstParentID = ConnectedWallet.secondParentID;
    }
    ConnectedWallet.secondParentID = null;
    if (!suppressUIUpdate) {
      let label = document.getElementById('mint-label');
      let button = document.getElementById('mint-button');
      label.innerHTML = 'Select two parents to breed with.';
      button.style.opacity = 0;
    }
  } else {
    if ((ConnectedWallet.firstParentID == null) && (ConnectedWallet.secondParentID == null)) {
      ConnectedWallet.firstParentID = punkID;
    } else {
      if (ConnectedWallet.secondParentID != null) {
        toggleSelection(ConnectedWallet.firstParentID, true);
      }
      ConnectedWallet.secondParentID = punkID;
      prepareMint();
    }
  }
};

var fetchTreePunks = function(punkIDs, levels, resultDict, keys) {
  if (punkIDs.length == 0) { 
    drawPunks(resultDict, 'tree', false);
    return; 
  }
  let punkID = punkIDs.shift();
  let level = levels.shift();
  Lostpunksociety.contract.methods.punkImageSvg(punkID).call((error, svgImage) => {
    if (error) { console.log(error); return; }
    var levelPunks = resultDict[level] ?? [];
    levelPunks.push({'svg':svgImage, 'id': punkID});
    resultDict[level] = levelPunks;
    Lostpunksociety.contract.methods.punkAttributes(punkID).call((error, attributes) => {
      if (error) { console.log(error); return; }
      Object.entries(parseAttributes(attributes)).forEach(([key, value]) => {
        if ((value != "-") && (value != "?")) {
          keys.forEach(k => {
            if (key == k) {
              punkIDs.push(value);  
              levels.push(level + 1);           
            }
          });
        }
      });
      fetchTreePunks(punkIDs, levels, resultDict, keys);
    });
  });
};

var addButtonEventHandlerWithKeys = function(button, keys) {
  button.addEventListener('click', function(e) {
    let placeholder = document.getElementById('tree-placeholder');
    let tree = document.getElementById('tree');
    let input = document.getElementById('punkId');

    tree.hidden = true;
    while (tree.firstChild) {
        tree.removeChild(tree.lastChild);
      }
    placeholder.hidden = false;
    fetchTreePunks([input.value], [0], {}, keys);
  });
};

var connectWallet = async () => {
  let accounts = await ethereum.request({ method: 'eth_requestAccounts' });
  ConnectedWallet.account = accounts[0];
  let button = document.getElementById('wallet-button');
  button.innerHTML = ConnectedWallet.account;
  loadWalletPunks();
};

var loadWalletPunks = function() {
  let wallet = document.getElementById('wallet');
  let placeholder = document.getElementById('wallet-placeholder');

  wallet.hidden = true;
  while (wallet.firstChild) {
    wallet.removeChild(wallet.lastChild);
  } 
  placeholder.hidden = false;
  ConnectedWallet.firstParentID = null;
  ConnectedWallet.secondParentID = null;

  var punkIDs = {};
  ConnectedWallet.testIDs.forEach(id => {
    punkIDs[id] = true;
  });
  Cryptopunks.contract.getPastEvents('PunkBought', { filter: { "toAddress" : ConnectedWallet.account }, fromBlock: Cryptopunks.originBlock }, function(error, events) {
      if (error) { console.log(error); return; }
      events.forEach(event => {
        punkIDs[event.returnValues["punkIndex"]] = true;
      });
      Cryptopunks.contract.getPastEvents('PunkTransfer', { filter: { "to" : ConnectedWallet.account }, fromBlock: Cryptopunks.originBlock }, function(error, events) {
          if (error) { console.log(error); return; }
          events.forEach(event => {
            punkIDs[event.returnValues["punkIndex"]] = true;
          });
          Lostpunksociety.contract.getPastEvents('Transfer', { filter: { "to" : ConnectedWallet.account }, fromBlock: Lostpunksociety.originBlock }, function(error, events) {
              if (error) { console.log(error); return; }
              events.forEach(event => {
                punkIDs[event.returnValues["tokenId"]] = true;
              });
              fetchWalletPunks(Object.keys(punkIDs), []);
          });
      });
  });
};

var fetchWalletPunks = function(punkIDs, results) {
  if (punkIDs.length == 0) { 
    drawPunks({ 0 : results }, 'wallet', true);

    let button = document.getElementById('mint-button');
    let label = document.getElementById('mint-label');
    
    button.style.opacity = 0;
    if (results.length > 1) {
      label.innerHTML = 'Select two parents to breed with.';
    } else {
      label.innerHTML = 'You need two parents to breed with.';
    }
    return; 
  }
  let punkID = punkIDs.shift();
  let contractMethod = punkID < 10000 ? Cryptopunks.contract.methods.punkIndexToAddress(punkID) : Lostpunksociety.contract.methods.ownerOf(punkID);

  contractMethod.call((error, ownerAddress) => {
    if (error) { console.log(error); return; }
    if(ownerAddress.toLowerCase() === ConnectedWallet.account.toLowerCase()) {
      Lostpunksociety.contract.methods.punkImageSvg(punkID).call((error, svgImage) => {
        if (error) { console.log(error); return; }
        results.push({'svg': svgImage, 'id': punkID});
        fetchWalletPunks(punkIDs, results);
      });
    } else {
      fetchWalletPunks(punkIDs, results);
    }
  });
};

var prepareMint = function() {
  Lostpunksociety.contract.methods.punkAttributes(ConnectedWallet.firstParentID).call((error, attributes) => {
    if (error) { console.log(error); return; }
    var firstParentAttributes = parseAttributes(attributes);
    firstParentAttributes['id'] = ConnectedWallet.firstParentID;
    Lostpunksociety.contract.methods.punkAttributes(ConnectedWallet.secondParentID).call((error, attributes) => {
      if (error) { console.log(error); return; }
      var secondParentAttributes = parseAttributes(attributes);
      secondParentAttributes['id'] = ConnectedWallet.secondParentID;
      validateMint(firstParentAttributes, secondParentAttributes);
    });
  });
};

var validateMint = function(father, mother) {
  let label = document.getElementById('mint-label');
  let button = document.getElementById('mint-button');

  label.innerHTML = '';
  button.style.opacity = 0;

  if (father['type'].startsWith('Female')) {
    [father, mother] = [mother, father];
  }

  let fatherID = father['id'];
  let motherID = mother['id'];
  let fatherType = father['type'];
  let motherType = mother['type'];

  if (father['Child 2'] !== '-') {
    label.innerHTML = "Punk #" + fatherID + " already has two children.";
    return;
  }
  if (mother['Child 2'] !== '-') {
    label.innerHTML = "Punk #" + motherID + " already has two children.";
    return;
  }
  if (fatherType.startsWith('Alien') || fatherType.startsWith('Ape')) {
    if (motherType !== fatherType) {
      label.innerHTML = "Cross-species breeding is not supported.";
      return;
    }
  } else if (fatherType.startsWith('Female') || !motherType.startsWith('Female')) {
    label.innerHTML = "You need both a mother and a father to breed children.";
    return;
  }
  let fm = father['Mother'];
  let mf = mother['Father'];
  if (((fm != '-') && (fm != '?') && ((fm == mother['Mother']) || (fm == motherID))) ||
      ((mf != '-') && (mf != '?') && ((mf == father['Father']) || (mf == fatherID)))) {
    label.innerHTML = motherID + " and " + fatherID + " are too closely related.";
    return;
  }

  let priceInWei = Math.max(father['Generation'], mother['Generation']) * 50000000000000000;

  button.innerHTML = "Mint Child (" + Web3.utils.fromWei(priceInWei.toString(), 'ether') + "E)";
  button.onclick = function() { mint(fatherID, motherID, priceInWei) };
  button.style.opacity = 100;
};

var parseAttributes = function(attributes) {
  var parsedAttributes = {};
  attributes.split(', ').forEach(att => {
    let keyValue = att.split(': ')
    if (keyValue.length > 1) {
      parsedAttributes[keyValue[0]] = keyValue[1];
    } else if (parsedAttributes['type'] == null) {
      parsedAttributes['type'] = keyValue[0];
    }
  });
  return parsedAttributes;
};

var mint = async (fatherIndex, motherIndex, priceInWei) => {
 let tx = {
      from: ConnectedWallet.account, 
      to: Lostpunksociety.address, 
      value: priceInWei.toString(16),
      data: Lostpunksociety.contract.methods.mintLostPunk(fatherIndex, motherIndex).encodeABI()
  };

  let label = document.getElementById('mint-label');
  let button = document.getElementById('mint-button');

  await ethereum.request({
      method: 'eth_sendTransaction',
      params: [tx],
  })
  .then(function (txHash) {
    label.innerHTML = "Minting Lost Punk...";
    label.style.opacity = 100;
    button.innerHTML = "View on Etherscan";
    button.onclick = function() { 
      let url = BaseURLs.etherscan + txHash;
      window.open(url, '_blank').focus();
    }
    return waitForTransaction(txHash);
  })
  .then(function (receipt) {
    let logs = receipt["logs"];
    let topics = logs[logs.length - 1]["topics"];
    let punkID = parseInt(topics[topics.length - 1], 16);

    label.innerHTML = "Minted Lost Punk #" + punkID;
    button.innerHTML = "View on OpenSea";
    button.onclick = function() { 
        let url = BaseURLs.opensea + Lostpunksociety.address + '/' + punkID;
        window.open(url, '_blank').focus();
    }
    Lostpunksociety.contract.methods.punkImageSvg(punkID).call((error, svgImage) => {
      if (error) { console.log(error); return; }
      drawPunks({ 0 : [{'svg': svgImage, 'id': punkID}] }, 'wallet', true);
    });
  });
};

function waitForTransaction(txHash) {
    return new Promise(function(resolve, reject) {
        (function attempt(triesLeft) {
            web3.eth.getTransactionReceipt(txHash, function(err, res) {
                if (err) return reject(err);
                if (res) return resolve(res);
                if (!triesLeft) return reject("max_tries_exceeded");
                setTimeout(attempt.bind(null, triesLeft-1), 5000);
            });
        })(60);
    });
};

