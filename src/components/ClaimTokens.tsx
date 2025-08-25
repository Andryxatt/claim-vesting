import React, { useState, useCallback, useEffect } from "react";
import { useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import { useAppKitConnection } from "@reown/appkit-adapter-solana/react";
import { debounce } from "lodash";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getMint,
} from "@solana/spl-token";
import { AnchorProvider, Idl, Program, Wallet, BN } from "@coral-xyz/anchor";
import idlTokenVesting from "../assets/token_vesting.json";
import { Buffer } from "buffer";

if (!window.Buffer) {
  window.Buffer = Buffer;
}

const MINT = new PublicKey(import.meta.env.VITE_TOKEN_MINT);
const PROGRAM_ID = new PublicKey(import.meta.env.VITE_PROGRAM_ID);

const ClaimToken: React.FC = () => {
  const [companyName, setCompanyName] = useState("refferAI");
  const [isAvailableClaim, setIsAvailableClaim] = useState(false);
  const [claimable, setClaimable] = useState<number>(0);
  const [claimed, setClaimed] = useState<number>(0);
  const [decimals, setDecimals] = useState<number>(9);
  const [symbol, setSymbol] = useState<string>("TOKEN"); // якщо немає метаданих

  const { address } = useAppKitAccount();
  const { connection } = useAppKitConnection();
  const { walletProvider } = useAppKitProvider<Wallet>("solana");

  // Тягнемо mint info
  useEffect(() => {
    const fetchMintInfo = async () => {
      if (!connection) return;
      try {
        const mintInfo = await getMint(connection, MINT);
        setDecimals(mintInfo.decimals);
        console.log("🪙 Mint info:", mintInfo);
        // символ залишаємо "TOKEN" якщо немає метаданих
        setSymbol("TOKEN");
      } catch (err) {
        console.error("❌ Не вдалося витягнути mint info:", err);
      }
    };
    fetchMintInfo();
  }, [connection]);

  // Пошук по seeds (companyName)
  const onChangeSearch = useCallback(
    debounce(async (value: string) => {
      if (!walletProvider || !connection || !address) return;

      const provider = new AnchorProvider(connection!, walletProvider, {
        preflightCommitment: "processed",
      });
      const program = new Program(idlTokenVesting as Idl, provider);

      const vestings = await (program.account as any).vestingAccount.all();
      const myVesting = vestings.find((v: any) => v.account.companyName === value);

      if (!myVesting) {
        setIsAvailableClaim(true);
        setClaimable(0);
        setClaimed(0);
        return;
      }

      setCompanyName(myVesting.account.companyName);
      setIsAvailableClaim(false);

      try {
        const beneficiary = new PublicKey(address);
        const [employeeAccountPda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("employee_vesting"),
            beneficiary.toBuffer(),
            myVesting.publicKey.toBuffer(),
          ],
          PROGRAM_ID
        );

        const employeeAcc = await (program.account as any).employeeAccount.fetch(
          employeeAccountPda
        );

        const totalAmount = (employeeAcc.totalAmount as BN).toNumber();
        const totalWithdrawn = (employeeAcc.totalWithdrawn as BN).toNumber();
        const available = totalAmount - totalWithdrawn;

        setClaimed(totalWithdrawn);
        setClaimable(available);
      } catch (err) {
        console.error("❌ Не вдалося витягнути employeeAccount:", err);
        setClaimed(0);
        setClaimable(0);
      }
    }, 1000),
    [walletProvider, connection, address]
  );

  // Claim функція
  const claimTokens = async () => {
    try {
      if (!walletProvider || !connection || !address) return;

      const provider = new AnchorProvider(connection!, walletProvider, {
        preflightCommitment: "processed",
      });
      const program = new Program(idlTokenVesting as Idl, provider);

      const beneficiary = new PublicKey(address);
      const vestings = await (program.account as any).vestingAccount.all();
      const myVesting = vestings.find((v: any) => v.account.companyName === companyName);

      if (!myVesting) throw new Error("Вестинг для цього користувача не знайдено");

      const vestingAccount = myVesting.publicKey;
      const [employeeAccountPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("employee_vesting"),
          beneficiary.toBuffer(),
          vestingAccount.toBuffer(),
        ],
        PROGRAM_ID
      );
      const [treasuryTokenAccountPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vesting_treasury"), Buffer.from(companyName)],
        PROGRAM_ID
      );

      const ata = await getAssociatedTokenAddress(
        MINT,
        beneficiary,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const sig = await program.methods
        .claimTokens(companyName)
        .accounts({
          beneficiary,
          employeeAccount: employeeAccountPda,
          vestingAccount,
          MINT,
          treasuryTokenAccountPda,
          employeeTokenAccount: ata,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      alert(`✅ Claim success! Tx: https://explorer.solana.com/tx/${sig}?cluster=${import.meta.env.VITE_CLUSTER}`);
    } catch (err: any) {
      console.error("❌ Claim error:", err);
      alert(`❌ Claim failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Claim Tokens</h2>
      <div>
        <label>Search by seeds (companyName)</label>
        <input
          placeholder="Enter companyName seed"
          className="border p-2 rounded-md"
          type="text"
          onChange={(e) => onChangeSearch(e.target.value)}
        />
      </div>

      <div className="p-2 bg-gray-100 rounded-md">
        Available for claim: <b>{claimable / 10 ** decimals}</b> {symbol}
      </div>
      <div>
        Already claimed: <b>{claimed / 10 ** decimals}</b> {symbol}
      </div>

      <button
        disabled={isAvailableClaim || claimable <= 0}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        onClick={claimTokens}
      >
        Claim
      </button>
    </div>
  );
};

export default ClaimToken;
