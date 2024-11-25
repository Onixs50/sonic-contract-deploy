/**
 * Sonic Token & NFT Deployer and Interaction Tool
 * Created by ONIXIA
 * Version 3.0.0
 */

import { 
    Connection, 
    PublicKey, 
    Keypair, 
    Transaction, 
    SystemProgram,
    sendAndConfirmTransaction 
} from '@solana/web3.js';
import * as splToken from '@solana/spl-token';
import { 
    Metaplex
} from '@metaplex-foundation/js';
import bs58 from 'bs58';
import fs from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Constants
const SONIC_RPC = 'https://api.testnet.v1.sonic.game';
const SONIC_EXPLORER = 'https://explorer.sonic.game/tx/';
const PRIVATE_KEYS_FILE = 'private-sonic.txt';

// ASCII Art Logo
const ONIXIA_LOGO = `
╔═══════════════════════════════════════════╗
║                 ONIXIA                    ║
║        Sonic Smart Contract Tool          ║
╚═══════════════════════════════════════════╝
`;

// Random transaction types
const TOKEN_INTERACTIONS = ['mint', 'transfer', 'burn'];
const NFT_INTERACTIONS = ['mint', 'transfer', 'update'];

// Clear screen utility
const clearScreen = () => {
    console.clear();
    console.log(chalk.yellow(ONIXIA_LOGO));
};

const rl = createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

class SonicDeployer {
    constructor() {
        this.connection = new Connection(SONIC_RPC, 'confirmed');
        this.metaplex = new Metaplex(this.connection);
        this.spinner = ora();
        this.deployments = [];
        this.interactions = [];
        this.settings = {
            interactionCount: 3,
            interactionInterval: 1,
        };
    }

    async init() {
        try {
            clearScreen();
            const privateKeys = fs.readFileSync(PRIVATE_KEYS_FILE, 'utf8')
                .split('\n')
                .map(key => key.trim())
                .filter(key => key.length > 0);

            // Create wallet objects with index
            this.wallets = privateKeys.map((key, index) => {
                try {
                    const keypair = Keypair.fromSecretKey(bs58.decode(key));
                    return {
                        index: index + 1,
                        keypair,
                        publicKey: keypair.publicKey,
                        tokenAccounts: new Map(),
                        nftAccounts: new Map()
                    };
                } catch (e) {
                    console.log(chalk.red(`❌ Error processing key ${index + 1}`));
                    return null;
                }
            }).filter(wallet => wallet !== null);

            if (this.wallets.length === 0) {
                throw new Error('No valid wallets found');
            }

            console.log(chalk.green(`✅ Loaded ${this.wallets.length} wallets successfully`));
            return true;
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log(chalk.red(`❌ ${PRIVATE_KEYS_FILE} not found.`));
                console.log(chalk.yellow('Create a file with one private key per line'));
            } else {
                console.log(chalk.red('❌ Error:', error.message));
            }
            return false;
        }
    }

async deployToken(wallet) {
    this.spinner.start(chalk.green(`🪙 Creating token with wallet #${wallet.index}...`));
    try {
        // Create mint account
        const mintAccount = await splToken.createMint(
            this.connection,
            wallet.keypair,           // payer
            wallet.publicKey,         // mint authority
            wallet.publicKey,         // freeze authority
            9                         // decimals
        );

            // Create associated token account
        const tokenAccount = await splToken.getOrCreateAssociatedTokenAccount(
            this.connection,
            wallet.keypair,
            mintAccount,
            wallet.publicKey
        );

        wallet.tokenAccounts.set(mintAccount.toBase58(), {
            mint: mintAccount,
            account: tokenAccount.address
        });

        this.spinner.succeed(chalk.green(`✅ Token created: ${mintAccount.toBase58()}`));
        return {
            address: mintAccount.toBase58(),
            tokenAccount: tokenAccount.address.toBase58()
        };
    } catch (error) {
        this.spinner.fail(chalk.red(`❌ Failed to create token: ${error.message}`));
        throw error;
    }
}

async performTokenInteraction(wallet, tokenData, action) {
    const tokenInfo = wallet.tokenAccounts.get(tokenData.address);
    if (!tokenInfo) throw new Error('Token not found');

    switch (action) {
        case 'mint':
            const amount = Math.floor(Math.random() * 1000) + 1;
            await splToken.mintTo(
                this.connection,
                wallet.keypair,
                tokenInfo.mint,
                tokenInfo.account,
                wallet.keypair,
                amount
            );
            return `Minted ${amount} tokens`;

        case 'transfer':
            const transferAmount = Math.floor(Math.random() * 100) + 1;
            const randomWallet = this.wallets[Math.floor(Math.random() * this.wallets.length)];
            const destinationAccount = await splToken.getOrCreateAssociatedTokenAccount(
                this.connection,
                wallet.keypair,
                tokenInfo.mint,
                randomWallet.publicKey
            );
            await splToken.transfer(
                this.connection,
                wallet.keypair,
                tokenInfo.account,
                destinationAccount.address,
                wallet.keypair,
                transferAmount
            );
            return `Transferred ${transferAmount} tokens to wallet #${randomWallet.index}`;

        case 'burn':
            const burnAmount = Math.floor(Math.random() * 50) + 1;
            await splToken.burn(
                this.connection,
                wallet.keypair,
                tokenInfo.account,
                tokenInfo.mint,
                wallet.keypair,
                burnAmount
            );
            return `Burned ${burnAmount} tokens`;
    }
}
    async deployNFT(wallet) {
        this.spinner.start(chalk.green(`🎨 Creating NFT collection with wallet #${wallet.index}...`));
        try {
            // Create NFT metadata
            const metadata = {
                name: `ONIXIA NFT #${Date.now()}`,
                symbol: 'ONIX',
                description: 'Created by ONIXIA Sonic Deployer',
                sellerFeeBasisPoints: 500, // 5%
                image: null // No image for this example
            };

            // Create NFT using Metaplex
            const { nft } = await this.metaplex
                .nfts()
                .create({
                    uri: metadata,
                    name: metadata.name,
                    symbol: metadata.symbol,
                    sellerFeeBasisPoints: metadata.sellerFeeBasisPoints,
                    payer: wallet.keypair
                });

            wallet.nftAccounts.set(nft.address.toBase58(), nft);

            this.spinner.succeed(chalk.green(`✅ NFT Collection created: ${nft.address.toBase58()}`));
            return {
                address: nft.address.toBase58(),
                metadata: nft.metadataAddress.toBase58()
            };
        } catch (error) {
            this.spinner.fail(chalk.red(`❌ Failed to create NFT: ${error.message}`));
            throw error;
        }
    }

    async performTokenInteraction(wallet, tokenData, action) {
        const tokenInfo = wallet.tokenAccounts.get(tokenData.address);
        if (!tokenInfo) throw new Error('Token not found');

        switch (action) {
            case 'mint':
                const amount = Math.floor(Math.random() * 1000) + 1;
                await mintTo(
                    this.connection,
                    wallet.keypair,
                    tokenInfo.mint,
                    tokenInfo.account,
                    wallet.keypair,
                    amount
                );
                return `Minted ${amount} tokens`;

            case 'transfer':
                const transferAmount = Math.floor(Math.random() * 100) + 1;
                const randomWallet = this.wallets[Math.floor(Math.random() * this.wallets.length)];
                const destinationAccount = await getOrCreateAssociatedTokenAccount(
                    this.connection,
                    wallet.keypair,
                    tokenInfo.mint,
                    randomWallet.publicKey
                );
                await transfer(
                    this.connection,
                    wallet.keypair,
                    tokenInfo.account,
                    destinationAccount.address,
                    wallet.keypair,
                    transferAmount
                );
                return `Transferred ${transferAmount} tokens to wallet #${randomWallet.index}`;

            case 'burn':
                const burnAmount = Math.floor(Math.random() * 50) + 1;
                await burn(
                    this.connection,
                    wallet.keypair,
                    tokenInfo.account,
                    tokenInfo.mint,
                    wallet.keypair,
                    burnAmount
                );
                return `Burned ${burnAmount} tokens`;
        }
    }

    async performNFTInteraction(wallet, nftData, action) {
        const nft = wallet.nftAccounts.get(nftData.address);
        if (!nft) throw new Error('NFT not found');

        switch (action) {
            case 'mint':
                const { nft: newNFT } = await this.metaplex
                    .nfts()
                    .create({
                        uri: nft.uri,
                        name: `${nft.name} #${Date.now()}`,
                        sellerFeeBasisPoints: nft.sellerFeeBasisPoints,
                        collection: nft.address,
                        payer: wallet.keypair
                    });
                return `Minted new NFT: ${newNFT.address.toBase58()}`;

            case 'transfer':
                const randomWallet = this.wallets[Math.floor(Math.random() * this.wallets.length)];
                await this.metaplex
                    .nfts()
                    .transfer({
                        nftOrSft: nft,
                        authority: wallet.keypair,
                        fromOwner: wallet.publicKey,
                        toOwner: randomWallet.publicKey
                    });
                return `Transferred NFT to wallet #${randomWallet.index}`;

            case 'updateMetadata':
                await this.metaplex
                    .nfts()
                    .update({
                        nftOrSft: nft,
                        name: `${nft.name} Updated ${Date.now()}`,
payer: wallet.keypair
                });
                return `Updated NFT metadata`;
        }
    }

    async showAllBalances() {
        clearScreen();
        console.log(chalk.yellow('\n📊 Wallet Balances'));
        
        const table = new Table({
            head: ['#', 'Wallet Address', 'Balance'].map(h => chalk.yellow(h))
        });

        for (const wallet of this.wallets) {
            const balance = await this.connection.getBalance(wallet.publicKey);
            table.push([
                chalk.green(`${wallet.index}`),
                chalk.cyan(wallet.publicKey.toString()),
                chalk.green(`${(balance / 1e9).toFixed(4)} SOL`)
            ]);
        }

        console.log(table.toString());
        await question(chalk.yellow('\nPress Enter to return to main menu...'));
    }

    async settingsMenu() {
        while (true) {
            clearScreen();
            console.log(chalk.yellow('\n⚙️  Settings'));
            console.log(chalk.green('1. Set Number of Interactions'));
            console.log(chalk.green('2. Set Interaction Interval (minutes)'));
            console.log(chalk.green('3. View Current Settings'));
            console.log(chalk.green('4. Return to Main Menu'));

            const choice = await question(chalk.yellow('\nEnter your choice (1-4): '));

            switch (choice) {
                case '1':
                    const count = await question(chalk.yellow('Enter number of interactions: '));
                    this.settings.interactionCount = parseInt(count) || 3;
                    console.log(chalk.green('✅ Settings updated'));
                    await question(chalk.yellow('Press Enter to continue...'));
                    break;

                case '2':
                    const interval = await question(chalk.yellow('Enter interval in minutes: '));
                    this.settings.interactionInterval = parseInt(interval) || 1;
                    console.log(chalk.green('✅ Settings updated'));
                    await question(chalk.yellow('Press Enter to continue...'));
                    break;

                case '3':
                    console.log(chalk.cyan('\nCurrent Settings:'));
                    console.log(chalk.green(`• Interactions per wallet: ${this.settings.interactionCount}`));
                    console.log(chalk.green(`• Interval between interactions: ${this.settings.interactionInterval} minutes`));
                    await question(chalk.yellow('\nPress Enter to continue...'));
                    break;

                case '4':
                    return;
            }
        }
    }

async startDeployment() {
    clearScreen();
    console.log(chalk.yellow('\n🚀 Contract Deployment'));
    console.log(chalk.green('1. Deploy Token'));
    console.log(chalk.green('2. Deploy NFT'));
    console.log(chalk.green('3. Return to Main Menu'));

    const choice = await question(chalk.yellow('\nEnter your choice (1-3): '));
    
    if (choice === '3') return;
    
    const contractType = choice === '1' ? 'Token' : 'NFT';
    const interactions = choice === '1' ? TOKEN_INTERACTIONS : NFT_INTERACTIONS;

    try {
        console.log(chalk.cyan(`\n📝 Deploying ${contractType} contracts and performing ${this.settings.interactionCount} interactions per wallet\n`));

        for (const wallet of this.wallets) {
            try {
                console.log(chalk.yellow(`\n👛 Processing Wallet #${wallet.index}: ${wallet.publicKey.toString()}`));
                
                // Check balance
                const balance = await this.connection.getBalance(wallet.publicKey);
                console.log(chalk.cyan(`Balance: ${(balance / 1e9).toFixed(4)} SOL`));
                
                if (balance < 0.1 * 1e9) {
                    console.log(chalk.red('❌ Insufficient balance, skipping wallet'));
                    continue;
                }

                // Deploy contract
                const result = choice === '1' 
                    ? await this.deployToken(wallet)
                    : await this.deployNFT(wallet);

                // Add to deployments
                this.deployments.push({
                    timestamp: new Date(),
                    walletIndex: wallet.index,
                    type: contractType,
                    address: result.address
                });

                // Perform random interactions
                console.log(chalk.yellow(`\n🔄 Starting ${this.settings.interactionCount} random interactions...\n`));
                
                for (let i = 1; i <= this.settings.interactionCount; i++) {
                    const action = interactions[Math.floor(Math.random() * interactions.length)];
                    
                    this.spinner.start(chalk.cyan(`Interaction ${i}/${this.settings.interactionCount}: ${action}`));
                    
                    try {
                        const interactionResult = choice === '1'
                            ? await this.performTokenInteraction(wallet, result, action)
                            : await this.performNFTInteraction(wallet, result, action);

                        this.spinner.succeed(chalk.green(`✅ ${interactionResult}`));
                        
                        // Add to interactions log
                        this.interactions.push({
                            timestamp: new Date(),
                            walletIndex: wallet.index,
                            type: contractType,
                            action: action,
                            result: interactionResult
                        });

                        // Wait for interval unless it's the last interaction
                        if (i < this.settings.interactionCount) {
                            await new Promise(r => setTimeout(r, this.settings.interactionInterval * 60 * 1000));
                        }
                    } catch (error) {
                        this.spinner.fail(chalk.red(`❌ Interaction failed: ${error.message}`));
                    }
                }

            } catch (error) {
                console.log(chalk.red(`\n❌ Error processing wallet: ${error.message}`));
                await question(chalk.yellow('Press Enter to continue with next wallet...'));
                continue;
            }
        }

        console.log(chalk.green('\n✅ Deployment and interactions completed!'));
        console.log(chalk.yellow('\n📄 Generating report...'));
        this.generateReport();
        await question(chalk.yellow('\nPress Enter to return to main menu...'));
        
    } catch (error) {
        console.log(chalk.red(`\n❌ An error occurred: ${error.message}`));
        await question(chalk.yellow('\nPress Enter to return to main menu...'));
    }
}
    generateReport() {
        const deployTable = new Table({
            head: ['Time', 'Wallet #', 'Type', 'Address'].map(h => chalk.yellow(h))
        });

        const interactionTable = new Table({
            head: ['Time', 'Wallet #', 'Type', 'Action', 'Result'].map(h => chalk.yellow(h))
        });

        this.deployments.forEach(d => {
            deployTable.push([
                chalk.cyan(d.timestamp.toLocaleTimeString()),
                chalk.green(`#${d.walletIndex}`),
                chalk.magenta(d.type),
                chalk.cyan(d.address.slice(0, 16) + '...')
            ]);
        });

        this.interactions.forEach(i => {
            interactionTable.push([
                chalk.cyan(i.timestamp.toLocaleTimeString()),
                chalk.green(`#${i.walletIndex}`),
                chalk.magenta(i.type),
                chalk.yellow(i.action),
                chalk.cyan(i.result)
            ]);
        });

        const report = `
=== ONIXIA Sonic Deployment Report ===

Deployments:
${deployTable.toString()}

Interactions:
${interactionTable.toString()}

Generated at: ${new Date().toISOString()}
`;

        const filename = `sonic-report-${Date.now()}.txt`;
        fs.writeFileSync(filename, report);
        console.log(chalk.green(`\n📄 Report saved to ${filename}`));

        return report;
    }

    async viewPreviousReports() {
        clearScreen();
        const reports = fs.readdirSync('.')
            .filter(file => file.startsWith('sonic-report-'))
            .sort()
            .reverse();

        if (reports.length === 0) {
            console.log(chalk.red('\n❌ No previous reports found'));
            await question(chalk.yellow('\nPress Enter to return to main menu...'));
            return;
        }

        console.log(chalk.yellow('\n📚 Previous Reports'));
        reports.forEach((report, i) => console.log(chalk.green(`${i + 1}. ${report}`)));

        const choice = await question(chalk.yellow('\nSelect report number (or Enter to return): '));
        if (!choice) return;

        const selectedReport = reports[parseInt(choice) - 1];
        if (selectedReport) {
            clearScreen();
            console.log(fs.readFileSync(selectedReport, 'utf8'));
            await question(chalk.yellow('\nPress Enter to return to main menu...'));
        }
    }

    async displayMenu() {
        while (true) {
            clearScreen();
            console.log(chalk.yellow('\n🔱 Main Menu'));
            console.log(chalk.green('1. Check Wallet Balances'));
            console.log(chalk.green('2. Deploy Contracts'));
            console.log(chalk.green('3. Settings'));
            console.log(chalk.green('4. View Previous Reports'));
            console.log(chalk.green('5. Exit'));

            const choice = await question(chalk.yellow('\nEnter your choice (1-5): '));

            switch (choice) {
                case '1':
                    await this.showAllBalances();
                    break;
                case '2':
                    await this.startDeployment();
                    break;
                case '3':
                    await this.settingsMenu();
                    break;
                case '4':
                    await this.viewPreviousReports();
                    break;
                case '5':
                    console.log(chalk.green('\n👋 Thank you for using ONIXIA Sonic Deployer!'));
                    rl.close();
                    return;
                default:
                    console.log(chalk.red('❌ Invalid choice!'));
                    await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }
}

// Main program entry
async function main() {
    clearScreen();
    const deployer = new SonicDeployer();
    
    if (!await deployer.init()) {
        console.log(chalk.red('\n❌ Initialization failed. Please check your configuration.'));
        process.exit(1);
    }

    await deployer.displayMenu();
}

// Error handling
process.on('unhandledRejection', (error) => {
    console.log(chalk.red('\n❌ An error occurred:', error.message));
    process.exit(1);
});

main().catch((error) => {
    console.log(chalk.red('\n❌ An error occurred:', error.message));
    process.exit(1);
});
