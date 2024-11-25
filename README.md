# Sonic Smart Contract Deployer

Created by ONIXIA

## Features
- Deploy tokens on Sonic Network
- Perform random interactions (mint, transfer, burn)
- Configurable interaction intervals
- Detailed reporting system
- Wallet balance checking

## Prerequisites
- Node.js v16+
- npm or yarn
- Git

## Installation

1. Clone the repository:
```bash
git clone https://github.com/Onixs50/sonic-contract-deploy.git
cd sonic-contract-deploy
```
# Initialize npm and install dependencies
```bash
npm init -y
npm install @solana/web3.js @solana/spl-token @metaplex-foundation/js bs58 chalk cli-table3 ora
```
2. Install dependencies:
```bash
npm install
```

3. Create `private-sonic.txt` file with your private keys (one per line):
```
your_private_key_1
your_private_key_2
...
```

## Usage

Run the deployer:
```bash
node deploy.js
```

## Menu Options
1. Check Wallet Balances
2. Deploy Contracts
3. Settings
4. View Previous Reports
5. Exit


