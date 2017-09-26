/**
 * Miner Away - Stop coin miners in your browser
 **
 * @author      Arthur Geron
 * @version     1.0
 * @license     GNULGPL3.0
 * @source      https://github.com/arthurgeron/MinerAway
 */

// Config
let temp = {
    blockedTabs: []    
}
const defaultConfig = {
    toggle: true,
    whitelist: [{
        domain: 'cnhv.co',
        expiration: 0,
    }],
    count: 0
};

const totalBlockCounter = {
    render: () => {
        chrome.browserAction.setBadgeText({text: defaultConfig.count.toString()});
    },
    increase: () => {
        defaultConfig.count++;
        totalBlockCounter.render();
    },

    clear: () => {
        defaultConfig.count = 0;
        totalBlockCounter.render();
    }
}

const sendTotalCounter = () => {
    //chrome.runtime.sendMessage({type: 'BLOCKED_COUNT', count: defaultConfig.count });
}

const localConfig = JSON.parse(localStorage.getItem('config'));
let config = {
    ...defaultConfig,
    ...localConfig,
};

// Load the blacklist and run the request checker

const blacklist = chrome.runtime.getURL("blacklist.txt");
let blacklistedUrls, lastSelectedTabId = 0;
/**
 * Functions
 */
const saveConfig = () => {
    localStorage.setItem('config', JSON.stringify(config));
};

const blackListContainsTabId = (tabId) => {
    return temp.blockedTabs.find(item => {return item.id === tabId}) !== undefined;
}
const isBlackListed = async (domain, tabId) => {
    while(blacklistedUrls  === undefined){
    }
    return searchDomainArray(domain, blacklistedUrls) || blackListContainsTabId(tabId); 
}

const isBlackListedSynchronous = (domain, tabId) => {
    return searchDomainArray(domain, blacklistedUrls) || blackListContainsTabId(tabId); 
}

const changeToggleIcon = (isEnabled) => {
    chrome.browserAction.setIcon({
        path: 'img/'+ (isEnabled ? 'logo' : 'logo_disabled') + '.png',
    });
};

const searchDomainArray = (domain, array) => {
    for (element of array) {
        if(domain === getDomain(element)) {
            return true;
        }
    }
    return false;
}

const getDomain = (url) => {
    let regex = /:\/\/(.[^/]+)/gi, output = [];
    if (!!url) {
        while (matches = regex.exec(url)) {
            output.push(matches[1]);
        }
        if (output.length>=1) {
            return output[0];
        }
    }
    return url;
};

const getTimestamp = () => {
    return Math.floor(Date.now() / 1000);
};

const isDomainWhitelisted = (domain) => {
    if (!domain) return false;

    const domainInfo = config.whitelist.find(w => w.domain === domain);

    if (domainInfo) {
        if (domainInfo.expiration !== 0 && domainInfo.expiration <= getTimestamp()) {
            removeDomainFromWhitelist(domain);

            return false;
        }

        return true;
    }

    return false;
};

const notify = (title, message, icon = '../img/logo.png') => {
    chrome.notifications.create(
        {   
        type: 'basic', 
        iconUrl: icon, 
        title: title, 
        message: message 
        }
    );
}

const addDomainToWhitelist = (domain, time) => {
    if (!domain) return;

    // Make sure the domain is not already whitelisted before adding it
    if (!isDomainWhitelisted(domain)) {
        config.whitelist = [
            ...config.whitelist,
            {
                domain: domain,
                expiration: time === 0 ? 0 : getTimestamp() + (time * 60),
            },
        ];
        saveConfig();
    }
};

const removeDomainFromWhitelist = (domain) => {
    if (!domain) return;

    config.whitelist = config.whitelist.filter(w => w.domain !== domain);
    saveConfig();
}
const analyseCurrentTab = (domain, tabId) => {
    let isWhiteListed;
    let isInBlackList;
    let messageType;
    if (!config.toggle) {
        action('DISABLED', domain)
    }
    else { 
        isBlackListed(domain, tabId).then((blackListed) => {
            isWhiteListed = isDomainWhitelisted(domain);
            if (isWhiteListed && blackListed) {
                messageType = 'MINING';
            } else if (blackListed) {
                messageType = 'WARNING';
            } else {
                messageType = 'OK';
            }
            action(messageType, domain);
        });
    }
}


const action = (messageType, domain) => {
    let message;
    switch (messageType)
    {
        case 'MINING':
        message = 'The domain ' + domain + ' is currently mining!';
        break;

        case 'WARNING':
        message = 'The domain ' + domain + ' tried to run a miner but was blocked!';
        break;
    }
    if (message !== undefined) {
        notify(messageType, message);
    }
    chrome.runtime.sendMessage({ type: messageType });
}
/**
 * Main
 */
let domains = [];

const tabChangedDomain = (tabId, domain) => {
    let tab =  temp.blockedTabs.find(item => {return item.id === tabId});
    if (tab !== undefined) {
        if (tab.domain === domain) {
            return false;
        }
        return true;
    }
    return false;
} 

const changedSelectedTab = (currentTabId) => {
    if (lastSelectedTabId === currentTabId) {
        return true;
    } else {
        return false;
    }
    lastSelectedTabId = currentTabId;
}

const removeMatchingTabId = (tabId) => {
    let tab = temp.blockedTabs.find(item => {return item.id === tabId});
    temp.blockedTabs.splice(temp.blockedTabs.indexOf(tab), 1);
}
chrome.tabs.onActivated.addListener((tabId, changeInfo, tab, details) => {
    if(tabId !== undefined && tab !== undefined) {
        domains[tabId] = getDomain(tab.url);        
        if (tabChangedDomain(tabId, getDomain(tab.url))) {
            removeMatchingTabId(tabId);
        } else {
            analyseCurrentTab(getDomain(tab.url), tabId);
        }
    }
    if (changedSelectedTab(tabId)) {
        totalBlockCounter.clear(); 
    }
});

// Updating domain for synchronous checking in onBeforeRequest
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab, details) => {
    domains[tabId] = getDomain(tab.url);
    if (tabChangedDomain(tabId, getDomain(tab.url))) {
        removeMatchingTabId(tabId);
    } else {
        analyseCurrentTab(getDomain(tab.url), tabId);
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    domains.splice(tabId, 1);
    temp.blockedTabs.splice(temp.blockedTabs.indexOf(tabId), 1)
});

// Run with the right icon
if (!config.toggle) {
    changeToggleIcon(false);
}

fetch(blacklist)
    .then(resp => {
        resp.text()
            .then(text => {
                blacklistedUrls = text.split('\n');
                
                chrome.webRequest.onBeforeRequest.addListener(details => {
                    let domain = domains[details.tabId];
                    // Globally paused
                    if (!config.toggle) {
                        action('DISABLED', domain);
                        return { cancel: false };
                    }

                    // Is domain white listed
                    if (isDomainWhitelisted(domains[details.tabId])) {
                        if(isBlackListedSynchronous(domain, details.tabId)) {
                            action('MINING', domain);   
                        }
                        else {
                            action('OK', domain);
                        }
                        return { cancel: false };
                    }
                    if(isBlackListedSynchronous(domain, details.tabId)) {
                        action('WARNING', domain);
                        if (!blackListContainsTabId(details.tabId)) {
                            temp.blockedTabs.push({id: details.tabId, domain: domain});
                        }
                        totalBlockCounter.increase();
                        return { cancel: true };
                    } else {
                        action('OK', domain);
                        return { cancel: false };
                    }
                    
                }, { 
                    urls: blacklistedUrls
                }, ['blocking']);
            })
            .catch(err => {
                // TODO: Handle this
                alert('An error has occured, please report this to the developers!\n'+ err);
            });
    })
    .catch(err => {
        // TODO: Handle this
        console.log(err);
        alert('An error has occured, please report this to the developers!\n'+ err);
    });

// Communication with the popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
        case 'GET_STATE':
            sendResponse({
                whitelisted: isDomainWhitelisted(domains[message.tabId]),
                toggle: config.toggle,
            });
            break;
        case 'TOGGLE':
            config.toggle = !config.toggle;
            saveConfig();

            changeToggleIcon(config.toggle);
            sendResponse(config.toggle);
            break;
        case 'WHITELIST': 
            if (message.whitelisted) {
                removeDomainFromWhitelist(domains[message.tabId], message.time);
            } else {
                addDomainToWhitelist(domains[message.tabId], message.time);
            }

            sendResponse(!message.whitelisted);
            break;
        case 'STATUS': 
            chrome.tabs.query({
                active: true,               // Select active tabs
                lastFocusedWindow: true     // In the current window
            }, (tab) => {
                if (!!tab[0]) {
                    analyseCurrentTab(getDomain(tab[0].url), tab[0].id);
                }           
            });
            break;
        case 'BLOCKED_COUNT': 
            sendTotalCounter();
            break;
    }
});

totalBlockCounter.render();