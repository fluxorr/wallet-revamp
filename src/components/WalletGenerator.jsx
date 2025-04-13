import React, { useState, useEffect } from "react";
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from "bip39";
import { derivePath } from "ed25519-hd-key";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { ethers } from "ethers";
import { toast } from "react-toastify";


import { Buffer } from 'buffer';

// Polyfill Buffer for the browser environment
if (typeof window !== 'undefined') {
    window.Buffer = window.Buffer || Buffer;
}


import nacl from "tweetnacl";

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
        <div className="max-w-3xl mx-auto p-4 space-y-6">
            {wallets.length === 0 && (
                <div className="flex flex-col gap-4">
                    {pathTypes.length === 0 && (
                        <div className="flex gap-4 flex-col my-12">
                            <div className="flex flex-col gap-2">
                                <h1 className="text-4xl font-bold">
                                    Choose Your Blockchain
                                </h1>
                                <p className="text-gray-600 text-lg">
                                    Select a blockchain network to start creating wallets
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                    onClick={() => {
                                        setPathTypes(["501"]);
                                        toast.info("Solana selected");
                                    }}
                                >
                                    Solana
                                </button>
                                <button
                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                    onClick={() => {
                                        setPathTypes(["60"]);
                                        toast.info("Ethereum selected");
                                    }}
                                >
                                    Ethereum
                                </button>
                            </div>
                        </div>
                    )}

                    {pathTypes.length > 0 && (
                        <div className="flex flex-col gap-4 my-12">
                            <div className="flex flex-col gap-2">
                                <h1 className="text-4xl font-bold">
                                    Secret Recovery Phrase
                                </h1>
                                <p className="text-gray-600 text-lg">
                                    Save these words in a secure location. They are the only way to recover your funds.
                                </p>
                            </div>
                            <div className="flex flex-col md:flex-row gap-4">
                                <input
                                    type="text"
                                    className="w-full p-2 border rounded"
                                    placeholder="Enter your recovery phrase or leave blank to generate new"
                                    onChange={(e) => setMnemonicInput(e.target.value)}
                                    value={mnemonicInput}
                                />
                                <button
                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
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
                <div className="flex flex-col items-center gap-4 rounded-lg border p-8 shadow-sm">
                    <div
                        className="flex w-full justify-between items-center cursor-pointer"
                        onClick={() => setShowMnemonic(!showMnemonic)}
                    >
                        <h2 className="text-2xl font-bold">
                            Your Secret Recovery Phrase
                        </h2>
                        <button className="px-2 py-1 text-blue-600">
                            {showMnemonic ? "▲" : "▼"}
                        </button>
                    </div>

                    {showMnemonic && (
                        <div
                            className="flex flex-col w-full items-center justify-center"
                            onClick={() => copyToClipboard(mnemonicWords.join(" "))}
                        >
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 justify-center w-full items-center mx-auto my-8">
                                {mnemonicWords.map((word, index) => (
                                    <p
                                        key={index}
                                        className="bg-gray-100 hover:bg-gray-200 transition-all rounded-lg p-4"
                                    >
                                        {index + 1}. {word}
                                    </p>
                                ))}
                            </div>
                            <div className="text-sm text-gray-500 flex w-full gap-2 items-center hover:text-gray-700 transition-all">
                                📋 Click to copy entire phrase
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Display wallet pairs */}
            {wallets.length > 0 && (
                <div className="flex flex-col gap-8 mt-6">
                    <div className="flex md:flex-row flex-col justify-between w-full gap-4 md:items-center">
                        <h2 className="text-3xl font-bold">
                            {pathTypeName} Wallets
                            <span className="text-sm font-normal text-gray-500 ml-2">
                                ({wallets.length})
                            </span>
                        </h2>
                        <div className="flex gap-2">
                            {wallets.length > 1 && (
                                <button
                                    className="px-2 py-1 border rounded hidden md:block"
                                    onClick={() => setGridView(!gridView)}
                                >
                                    {gridView ? "List View" : "Grid View"}
                                </button>
                            )}
                            <button
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                onClick={handleAddWallet}
                            >
                                Add Wallet
                            </button>
                            <button
                                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                                onClick={() => {
                                    if (window.confirm("Are you sure you want to clear all wallets? This action cannot be undone.")) {
                                        handleClearWallets();
                                    }
                                }}
                            >
                                Clear All
                            </button>
                        </div>
                    </div>

                    <div
                        className={`grid gap-6 grid-cols-1 ${gridView ? "md:grid-cols-2 lg:grid-cols-3" : ""
                            }`}
                    >
                        {wallets.map((wallet, index) => (
                            <div
                                key={index}
                                className="flex flex-col rounded-lg border shadow-sm hover:shadow-md transition-shadow"
                            >
                                <div className="flex justify-between px-6 py-4 border-b">
                                    <h3 className="font-bold text-xl">
                                        Wallet #{index + 1}
                                    </h3>
                                    <button
                                        className="text-red-600 hover:text-red-800 transition-colors px-2"
                                        onClick={() => {
                                            if (window.confirm("Delete this wallet?")) {
                                                handleDeleteWallet(index);
                                            }
                                        }}
                                    >
                                        🗑️
                                    </button>
                                </div>
                                <div className="flex flex-col gap-6 px-6 py-4 rounded-lg bg-gray-50">
                                    <div
                                        className="flex flex-col w-full gap-2"
                                        onClick={() => copyToClipboard(wallet.publicKey)}
                                    >
                                        <span className="text-lg font-bold">
                                            Public Key
                                        </span>
                                        <p className="text-gray-700 cursor-pointer hover:text-gray-900 transition-all truncate bg-white p-2 rounded border">
                                            {wallet.publicKey}
                                        </p>
                                    </div>
                                    <div className="flex flex-col w-full gap-2">
                                        <span className="text-lg font-bold">
                                            Private Key
                                        </span>
                                        <div className="flex justify-between w-full items-center gap-2 bg-white p-2 rounded border">
                                            <p
                                                onClick={() => visiblePrivateKeys[index] && copyToClipboard(wallet.privateKey)}
                                                className="text-gray-700 cursor-pointer hover:text-gray-900 transition-all truncate"
                                            >
                                                {visiblePrivateKeys[index]
                                                    ? wallet.privateKey
                                                    : "•".repeat(Math.min(40, wallet.privateKey.length))}
                                            </p>
                                            <button
                                                className="text-blue-600 hover:text-blue-800 transition-colors"
                                                onClick={() => togglePrivateKeyVisibility(index)}
                                                title={visiblePrivateKeys[index] ? "Hide private key" : "Show private key"}
                                            >
                                                {visiblePrivateKeys[index] ? "👁️" : "👁️‍🗨️"}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex flex-col w-full gap-2">
                                        <span className="text-lg font-bold">
                                            Derivation Path
                                        </span>
                                        <p className="text-gray-700 bg-white p-2 rounded border">
                                            {wallet.path}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default WalletGenerator;