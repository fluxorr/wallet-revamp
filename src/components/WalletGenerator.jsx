import React, { useState, useEffect } from "react";
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from "bip39";
import * as ed from "@noble/ed25519";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { ethers } from "ethers";
import { toast } from "react-toastify";
import { Buffer } from 'buffer';
import nacl from "tweetnacl";

// Polyfill Buffer for the browser environment
if (typeof window !== 'undefined') {
    window.Buffer = window.Buffer || Buffer;
}

// Replacement for derivePath from ed25519-hd-key
const derivePath = (path, seed) => {

    const seedBuffer = Buffer.from(seed, 'hex');

    // For Solana derivation, we're using a simplified approach
    // This follows BIP32-Ed25519 derivation pattern
    const segments = path.split('/');
    let currentSeed = seedBuffer;


    for (let i = 1; i < segments.length; i++) {
        let segment = segments[i];
        let hardened = false;
        if (segment.endsWith("'")) {
            hardened = true;
            segment = segment.slice(0, -1);
        }

        if (hardened) {
            const indexBuffer = Buffer.alloc(4);
            indexBuffer.writeUInt32BE(parseInt(segment) + 0x80000000, 0);

            const data = Buffer.concat([
                Buffer.from([0]),
                currentSeed,
                indexBuffer
            ]);

            currentSeed = Buffer.from(
                nacl.hash(data)
            ).slice(0, 32); // Use first 32 bytes as new seed
        }
    }

    return { key: currentSeed };
};

const WalletGenerator = () => {
    const [mnemonicWords, setMnemonicWords] = useState([]);
    const [pathTypes, setPathTypes] = useState([]);
    const [wallets, setWallets] = useState([]);
    const [showMnemonic, setShowMnemonic] = useState(false);
    const [mnemonicInput, setMnemonicInput] = useState("");
    const [visiblePrivateKeys, setVisiblePrivateKeys] = useState([]);
    const [gridView, setGridView] = useState(false);

    const pathTypeNames = {
        "501": "Solana",
        "60": "Ethereum",
    };

    const pathTypeName = pathTypeNames[pathTypes[0]] || "";

    useEffect(() => {
        // Load saved wallets from localStorage
        try {
            const storedWallets = localStorage.getItem("wallets");
            const storedMnemonic = localStorage.getItem("mnemonics");
            const storedPathTypes = localStorage.getItem("paths");

            if (storedWallets && storedMnemonic && storedPathTypes) {
                setMnemonicWords(JSON.parse(storedMnemonic));
                setWallets(JSON.parse(storedWallets));
                setPathTypes(JSON.parse(storedPathTypes));
                setVisiblePrivateKeys(JSON.parse(storedWallets).map(() => false));
            }
        } catch (error) {
            console.error("Error loading saved wallets:", error);
            toast.error("Failed to load saved wallets");
        }
    }, []);

    const generateWalletFromMnemonic = (pathType, mnemonic, accountIndex) => {
        try {
            const seedBuffer = mnemonicToSeedSync(mnemonic);
            const path = `m/44'/${pathType}'/0'/${accountIndex}'`;
            const { key: derivedSeed } = derivePath(path, seedBuffer.toString("hex"));

            let publicKeyEncoded;
            let privateKeyEncoded;

            if (pathType === "501") {
                // Solana wallet
                const keyPair = nacl.sign.keyPair.fromSeed(derivedSeed);
                const solanaKeypair = Keypair.fromSecretKey(keyPair.secretKey);

                privateKeyEncoded = bs58.encode(keyPair.secretKey);
                publicKeyEncoded = solanaKeypair.publicKey.toBase58();
            } else if (pathType === "60") {
                // Ethereum wallet
                const privateKey = Buffer.from(derivedSeed).toString("hex");
                privateKeyEncoded = `0x${privateKey}`;

                const wallet = new ethers.Wallet(privateKeyEncoded);
                publicKeyEncoded = wallet.address;
            } else {
                toast.error("Unsupported blockchain type");
                return null;
            }

            return {
                publicKey: publicKeyEncoded,
                privateKey: privateKeyEncoded,
                mnemonic,
                path,
            };
        } catch (error) {
            console.error("Wallet generation error:", error);
            toast.error("Failed to generate wallet. Check console for details.");
            return null;
        }
    };

    const handleDeleteWallet = (index) => {
        const updatedWallets = wallets.filter((_, i) => i !== index);
        const updatedPathTypes = pathTypes.filter((_, i) => i !== index);

        setWallets(updatedWallets);
        setPathTypes(updatedPathTypes);
        localStorage.setItem("wallets", JSON.stringify(updatedWallets));
        localStorage.setItem("paths", JSON.stringify(updatedPathTypes));
        setVisiblePrivateKeys(visiblePrivateKeys.filter((_, i) => i !== index));
        toast.success("Wallet deleted");
    };

    const handleClearWallets = () => {
        localStorage.removeItem("wallets");
        localStorage.removeItem("mnemonics");
        localStorage.removeItem("paths");
        setWallets([]);
        setMnemonicWords([]);
        setPathTypes([]);
        setVisiblePrivateKeys([]);
        toast.info("All wallets cleared");
    };

    const copyToClipboard = (content) => {
        navigator.clipboard.writeText(content)
            .then(() => toast.success("Copied to clipboard"))
            .catch(() => toast.error("Failed to copy"));
    };

    const togglePrivateKeyVisibility = (index) => {
        setVisiblePrivateKeys(
            visiblePrivateKeys.map((visible, i) => (i === index ? !visible : visible))
        );
    };

    const handleGenerateWallet = () => {
        let mnemonic = mnemonicInput.trim();

        if (mnemonic) {
            if (!validateMnemonic(mnemonic)) {
                toast.error("Invalid recovery phrase");
                return;
            }
        } else {
            mnemonic = generateMnemonic();
        }

        const words = mnemonic.split(" ");
        setMnemonicWords(words);

        const wallet = generateWalletFromMnemonic(
            pathTypes[0],
            mnemonic,
            wallets.length
        );

        if (wallet) {
            const updatedWallets = [...wallets, wallet];
            setWallets(updatedWallets);
            localStorage.setItem("wallets", JSON.stringify(updatedWallets));
            localStorage.setItem("mnemonics", JSON.stringify(words));
            localStorage.setItem("paths", JSON.stringify(pathTypes));
            setVisiblePrivateKeys([...visiblePrivateKeys, false]);
            toast.success("Wallet created successfully");
        }
    };

    const handleAddWallet = () => {
        if (!mnemonicWords.length) {
            toast.warning("No mnemonic found. Generate a wallet first");
            return;
        }

        const wallet = generateWalletFromMnemonic(
            pathTypes[0],
            mnemonicWords.join(" "),
            wallets.length
        );

        if (wallet) {
            const updatedWallets = [...wallets, wallet];
            setWallets(updatedWallets);
            localStorage.setItem("wallets", JSON.stringify(updatedWallets));
            setVisiblePrivateKeys([...visiblePrivateKeys, false]);
            toast.success("Additional wallet created");
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100">
            <div className="max-w-6xl mx-auto p-6">
                {/* Header */}
                <div className="mb-12 pt-8">
                    <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                        Crypto Vault
                    </h1>
                    <p className="mt-3 text-gray-400 text-lg">
                        Secure wallet management for the decentralized world
                    </p>
                </div>

                {wallets.length === 0 && (
                    <div className="flex flex-col gap-6">
                        {pathTypes.length === 0 && (
                            <div className="rounded-2xl border border-gray-800 bg-gray-800/50 backdrop-blur-sm p-8 shadow-lg">
                                <div className="flex flex-col gap-4 mb-6">
                                    <h2 className="text-3xl font-bold text-blue-400">
                                        Choose Your Blockchain
                                    </h2>
                                    <p className="text-gray-400">
                                        Select a blockchain network to start creating your secure wallets
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-4">
                                    <button
                                        className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all duration-300 flex items-center gap-3 shadow-lg hover:shadow-blue-900/30"
                                        onClick={() => {
                                            setPathTypes(["501"]);
                                            toast.info("Solana selected");
                                        }}
                                    >
                                        <span className="text-2xl">◎</span>
                                        <span>Solana</span>
                                    </button>

                                    <button
                                        className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 flex items-center gap-3 shadow-lg hover:shadow-indigo-900/30"
                                        onClick={() => {
                                            setPathTypes(["60"]);
                                            toast.info("Ethereum selected");
                                        }}
                                    >
                                        <span className="text-2xl">Ξ</span>
                                        <span>Ethereum</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {pathTypes.length > 0 && (
                            <div className="rounded-2xl border border-gray-800 bg-gray-800/50 backdrop-blur-sm p-8 shadow-lg">
                                <div className="flex flex-col gap-3 mb-6">
                                    <h2 className="text-3xl font-bold text-blue-400">
                                        {pathTypeName === "Solana" ? "◎" : "Ξ"} Secret Recovery Phrase
                                    </h2>
                                    <p className="text-gray-400">
                                        Save these words in a secure location. They are the only way to recover your funds.
                                    </p>
                                </div>
                                <div className="flex flex-col md:flex-row gap-4">
                                    <input
                                        type="text"
                                        className="flex-1 p-3 border bg-gray-950 border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-200"
                                        placeholder="Enter your recovery phrase or leave blank to generate new"
                                        onChange={(e) => setMnemonicInput(e.target.value)}
                                        value={mnemonicInput}
                                    />
                                    <button
                                        className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-purple-900/30"
                                        onClick={handleGenerateWallet}
                                    >
                                        {mnemonicInput ? "Import Wallet" : "Generate Wallet"}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Display Secret Phrase */}
                {mnemonicWords.length > 0 && wallets.length > 0 && (
                    <div className="my-8 rounded-2xl border border-gray-800 bg-gray-800/50 backdrop-blur-sm p-6 shadow-lg">
                        <div
                            className="flex w-full justify-between items-center cursor-pointer"
                            onClick={() => setShowMnemonic(!showMnemonic)}
                        >
                            <h2 className="text-2xl font-bold text-blue-400 flex items-center gap-2">
                                <span className="text-purple-400">🔑</span>
                                Secret Recovery Phrase
                            </h2>
                            <button className="p-2 rounded-full hover:bg-gray-700/50 transition-colors text-blue-400">
                                {showMnemonic ? "▲" : "▼"}
                            </button>
                        </div>

                        {showMnemonic && (
                            <div
                                className="mt-6 flex flex-col w-full items-center justify-center"
                                onClick={() => copyToClipboard(mnemonicWords.join(" "))}
                            >
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 w-full">
                                    {mnemonicWords.map((word, index) => (
                                        <div
                                            key={index}
                                            className="bg-gray-950 border border-gray-800 hover:border-blue-500 transition-all rounded-lg p-3 flex items-center"
                                        >
                                            <span className="text-blue-400 mr-2 w-6 text-center">{index + 1}</span>
                                            <span className="text-gray-300">{word}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="text-sm text-gray-500 mt-4 flex w-full gap-2 items-center hover:text-blue-400 transition-all cursor-pointer">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                    </svg>
                                    Click to copy entire phrase
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Display wallet pairs */}
                {wallets.length > 0 && (
                    <div className="my-8">
                        <div className="flex md:flex-row flex-col justify-between w-full gap-4 md:items-center mb-8">
                            <h2 className="text-3xl font-bold text-blue-400 flex items-center gap-2">
                                <span className={pathTypeName === "Solana" ? "text-purple-500" : "text-blue-500"}>
                                    {pathTypeName === "Solana" ? "◎" : "Ξ"}
                                </span>
                                {pathTypeName} Wallets
                                <span className="text-sm font-normal text-gray-400 ml-2">
                                    ({wallets.length})
                                </span>
                            </h2>
                            <div className="flex gap-2">
                                {wallets.length > 1 && (
                                    <button
                                        className="px-3 py-2 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors text-gray-400 hover:text-white flex items-center gap-2"
                                        onClick={() => setGridView(!gridView)}
                                    >
                                        {gridView ? (
                                            <>
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                                </svg>
                                                List
                                            </>
                                        ) : (
                                            <>
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                                </svg>
                                                Grid
                                            </>
                                        )}
                                    </button>
                                )}
                                <button
                                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-md hover:shadow-purple-900/20 flex items-center gap-2"
                                    onClick={handleAddWallet}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Add Wallet
                                </button>
                                <button
                                    className="px-4 py-2 bg-gradient-to-r from-red-600 to-pink-600 rounded-lg hover:from-red-700 hover:to-pink-700 transition-all shadow-md hover:shadow-red-900/20 flex items-center gap-2"
                                    onClick={() => {
                                        if (window.confirm("Are you sure you want to clear all wallets? This action cannot be undone.")) {
                                            handleClearWallets();
                                        }
                                    }}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    Clear All
                                </button>
                            </div>
                        </div>

                        <div
                            className={`grid gap-6 grid-cols-1 ${gridView ? "md:grid-cols-2 lg:grid-cols-3" : ""}`}
                        >
                            {wallets.map((wallet, index) => (
                                <div
                                    key={index}
                                    className="rounded-2xl border border-gray-800 bg-gray-800/50 backdrop-blur-sm overflow-hidden shadow-lg hover:shadow-xl transition-all hover:border-gray-700"
                                >
                                    <div className="flex justify-between items-center px-6 py-4 border-b border-gray-800 bg-gray-900">
                                        <h3 className="font-bold text-xl text-blue-400 flex items-center gap-2">
                                            <span className={`text-lg ${pathTypeName === "Solana" ? "text-purple-400" : "text-blue-400"}`}>
                                                {pathTypeName === "Solana" ? "◎" : "Ξ"}
                                            </span>
                                            Wallet #{index + 1}
                                        </h3>
                                        <button
                                            className="text-red-500 hover:text-red-400 transition-colors p-2 rounded-full hover:bg-gray-800"
                                            onClick={() => {
                                                if (window.confirm("Delete this wallet?")) {
                                                    handleDeleteWallet(index);
                                                }
                                            }}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                    <div className="flex flex-col gap-6 px-6 py-5">
                                        <div className="flex flex-col w-full gap-2">
                                            <span className="text-lg font-medium text-gray-400 flex items-center gap-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                                </svg>
                                                Public Key
                                            </span>
                                            <div
                                                className="group bg-gray-950 border border-gray-800 hover:border-green-500/30 rounded-lg p-3 cursor-pointer transition-all"
                                                onClick={() => copyToClipboard(wallet.publicKey)}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <p className="text-gray-300 truncate pr-2">
                                                        {wallet.publicKey}
                                                    </p>
                                                    <span className="text-gray-600 group-hover:text-green-500 transition-colors">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                        </svg>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col w-full gap-2">
                                            <span className="text-lg font-medium text-gray-400 flex items-center gap-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                </svg>
                                                Private Key
                                            </span>
                                            <div className="flex justify-between w-full bg-gray-950 border border-gray-800 hover:border-red-500/30 rounded-lg p-3 transition-all">
                                                <p
                                                    onClick={() => visiblePrivateKeys[index] && copyToClipboard(wallet.privateKey)}
                                                    className={`truncate pr-2 ${visiblePrivateKeys[index] ? "text-gray-300 cursor-pointer" : "text-gray-600"}`}
                                                >
                                                    {visiblePrivateKeys[index]
                                                        ? wallet.privateKey
                                                        : "•".repeat(Math.min(40, wallet.privateKey.length))}
                                                </p>
                                                <button
                                                    className={`transition-colors ${visiblePrivateKeys[index] ? "text-red-500 hover:text-red-400" : "text-gray-500 hover:text-gray-400"}`}
                                                    onClick={() => togglePrivateKeyVisibility(index)}
                                                    title={visiblePrivateKeys[index] ? "Hide private key" : "Show private key"}
                                                >
                                                    {visiblePrivateKeys[index] ? (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                                        </svg>
                                                    ) : (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                        </svg>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="mt-16 mb-8 text-center text-gray-500 text-sm">
                    <div className="mt-3 flex justify-center gap-4">
                        {/* X */}
                        <div className="p-2 border border-gray-800 rounded-lg hover:border-blue-500/30 transition-all">
                            <a href="https://x.com/cipherotaku04" target="_blank">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z" />
                                </svg>
                            </a>
                        </div>
                        {/* gh */}
                        <div className="p-2 border border-gray-800 rounded-lg hover:border-blue-500/30 transition-all">
                            <a href="https://github.com/fluxorr" target="_blank">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22" />
                                </svg>
                            </a>
                        </div>
                    </div>
                    <p className="mt-4">&copy; {new Date().getFullYear()} Made with 🫶🏼 by Rahul.</p>
                </div>

            </div>
        </div>
    )
}


export default WalletGenerator