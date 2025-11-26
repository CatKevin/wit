import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { Crown, Users, UserPlus, X, Loader2, AlertCircle, Check } from 'lucide-react';
import { AddressAvatar } from '@/components/ui/address-avatar';
import { Copyable } from '@/components/ui/copyable';
import { Button } from '@/components/ui/button';
import type { Repository } from '@/lib/sui';

const WIT_PACKAGE_ID = '0x8c91d82b2292ac53a4fa5b21de86b1073230ac1d17dd6ae336ab5b559c329e09';
const WIT_MODULE_NAME = 'repository';

interface CollaboratorsListProps {
    repo: Repository;
    onCollaboratorAdded?: () => void;
}

function shortenAddress(address: string): string {
    if (address.length <= 16) return address;
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

export function CollaboratorsList({ repo, onCollaboratorAdded }: CollaboratorsListProps) {
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteAddress, setInviteAddress] = useState('');
    const [isInviting, setIsInviting] = useState(false);
    const [inviteError, setInviteError] = useState<string | null>(null);
    const [inviteSuccess, setInviteSuccess] = useState(false);

    const account = useCurrentAccount();
    const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

    const isOwner = account?.address === repo.owner;
    const canInvite = isOwner; // Only owner can invite collaborators

    const handleInvite = async () => {
        if (!inviteAddress || !account) return;

        // Validate address format
        if (!inviteAddress.startsWith('0x') || inviteAddress.length !== 66) {
            setInviteError('Invalid address format. Must be 0x followed by 64 hex characters.');
            return;
        }

        setIsInviting(true);
        setInviteError(null);

        try {
            const tx = new Transaction();

            if (repo.seal_policy_id) {
                // Private repo: use add_private_collaborator
                tx.moveCall({
                    target: `${WIT_PACKAGE_ID}::${WIT_MODULE_NAME}::add_private_collaborator`,
                    arguments: [
                        tx.object(repo.id),
                        tx.object(repo.seal_policy_id),
                        tx.pure.address(inviteAddress)
                    ],
                });
            } else {
                // Public repo: use add_collaborator
                tx.moveCall({
                    target: `${WIT_PACKAGE_ID}::${WIT_MODULE_NAME}::add_collaborator`,
                    arguments: [
                        tx.object(repo.id),
                        tx.pure.address(inviteAddress)
                    ],
                });
            }

            await signAndExecute({
                transaction: tx as any,
            }, {
                onSuccess: () => {
                    setInviteSuccess(true);
                    setTimeout(() => {
                        setShowInviteModal(false);
                        setInviteAddress('');
                        setInviteSuccess(false);
                        onCollaboratorAdded?.();
                    }, 1500);
                },
            });
        } catch (err: any) {
            const msg = err?.message || String(err);
            if (msg.includes('ENotAuthorized') || msg.includes('NotAuthorized')) {
                setInviteError('Not authorized. Only the repository owner can invite collaborators.');
            } else if (msg.includes('rejected')) {
                setInviteError('Transaction was rejected.');
            } else {
                setInviteError(`Failed to add collaborator: ${msg}`);
            }
        } finally {
            setIsInviting(false);
        }
    };

    return (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-slate-500" />
                    <span className="text-slate-600 text-sm font-medium">Contributors</span>
                    <span className="px-1.5 py-0.5 rounded-full bg-slate-200 text-xs text-slate-600">
                        {1 + repo.collaborators.length}
                    </span>
                </div>
                {canInvite && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowInviteModal(true)}
                        className="h-7 text-xs gap-1"
                    >
                        <UserPlus className="h-3 w-3" />
                        Invite
                    </Button>
                )}
            </div>

            {/* Owner */}
            <div className="p-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <AddressAvatar address={repo.owner} size="md" />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                            <Crown className="h-3 w-3 text-amber-500 flex-shrink-0" />
                            <span className="text-xs text-amber-700 font-medium">Owner</span>
                        </div>
                        <Copyable
                            value={repo.owner}
                            displayValue={shortenAddress(repo.owner)}
                            className="text-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Collaborators */}
            {repo.collaborators.length > 0 ? (
                <div className="divide-y divide-slate-100">
                    {repo.collaborators.map((collab, index) => (
                        <motion.div
                            key={collab}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="p-3"
                        >
                            <div className="flex items-center gap-3">
                                <AddressAvatar address={collab} size="md" />
                                <div className="flex-1 min-w-0">
                                    <Copyable
                                        value={collab}
                                        displayValue={shortenAddress(collab)}
                                        className="text-sm"
                                    />
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            ) : (
                <div className="p-4 text-center">
                    <p className="text-slate-400 text-sm">No collaborators yet</p>
                </div>
            )}

            {/* Invite Modal */}
            <AnimatePresence>
                {showInviteModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
                        onClick={() => !isInviting && setShowInviteModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden"
                        >
                            {/* Modal Header */}
                            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <UserPlus className="h-5 w-5 text-slate-600" />
                                    <h3 className="font-semibold text-slate-900">Invite Collaborator</h3>
                                </div>
                                <button
                                    onClick={() => !isInviting && setShowInviteModal(false)}
                                    className="p-1 rounded-lg hover:bg-slate-100 transition-colors"
                                    disabled={isInviting}
                                >
                                    <X className="h-5 w-5 text-slate-400" />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="px-6 py-4 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Wallet Address
                                    </label>
                                    <input
                                        type="text"
                                        value={inviteAddress}
                                        onChange={(e) => {
                                            setInviteAddress(e.target.value);
                                            setInviteError(null);
                                        }}
                                        placeholder="0x..."
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                                        disabled={isInviting}
                                    />
                                    <p className="mt-2 text-xs text-slate-500">
                                        Enter the Sui wallet address of the user you want to invite.
                                    </p>
                                </div>

                                {inviteError && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-100"
                                    >
                                        <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                                        <p className="text-sm text-red-700">{inviteError}</p>
                                    </motion.div>
                                )}

                                {inviteSuccess && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-100"
                                    >
                                        <Check className="h-4 w-4 text-green-500" />
                                        <p className="text-sm text-green-700">Collaborator added successfully!</p>
                                    </motion.div>
                                )}

                                {repo.seal_policy_id && (
                                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                                        <p className="text-xs text-slate-600">
                                            This is a private repository. The user will be added to the whitelist and will be able to decrypt repository content.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => setShowInviteModal(false)}
                                    disabled={isInviting}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleInvite}
                                    disabled={isInviting || !inviteAddress || inviteSuccess}
                                    className="gap-2"
                                >
                                    {isInviting ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Inviting...
                                        </>
                                    ) : inviteSuccess ? (
                                        <>
                                            <Check className="h-4 w-4" />
                                            Added!
                                        </>
                                    ) : (
                                        <>
                                            <UserPlus className="h-4 w-4" />
                                            Send Invite
                                        </>
                                    )}
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
