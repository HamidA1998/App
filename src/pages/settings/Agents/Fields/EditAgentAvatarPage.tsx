import React, {useRef, useState} from 'react';
import {View} from 'react-native';
import AttachmentPicker from '@components/AttachmentPicker';
import Avatar from '@components/Avatar';
import AvatarCropModal from '@components/AvatarCropModal/AvatarCropModal';
import Button from '@components/Button';
import DotIndicatorMessage from '@components/DotIndicatorMessage';
import FixedFooter from '@components/FixedFooter';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import type {BotAvatar} from '@components/Icon/DefaultBotAvatars';
import {botAvatarIDs, botAvatars} from '@components/Icon/DefaultBotAvatars';
import {PressableWithFeedback} from '@components/Pressable';
import ScreenWrapper from '@components/ScreenWrapper';
import ScrollView from '@components/ScrollView';
import Text from '@components/Text';
import useDiscardChangesConfirmation from '@hooks/useDiscardChangesConfirmation';
import {useMemoizedLazyExpensifyIcons} from '@hooks/useLazyAsset';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import {validateAvatarImage} from '@libs/AvatarUtils';
import type {CustomRNImageManipulatorResult} from '@libs/cropOrRotateImage/types';
import Navigation from '@libs/Navigation/Navigation';
import type {PlatformStackScreenProps} from '@libs/Navigation/PlatformStackNavigation/types';
import type {SettingsNavigatorParamList} from '@libs/Navigation/types';
import type {AvatarSource} from '@libs/UserAvatarUtils';
import {updateAgentAvatar} from '@userActions/Agent';
import CONST from '@src/CONST';
import type {TranslationPaths} from '@src/languages/types';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type SCREENS from '@src/SCREENS';
import type {FileObject} from '@src/types/utils/Attachment';

type EditAgentAvatarPageProps = PlatformStackScreenProps<SettingsNavigatorParamList, typeof SCREENS.SETTINGS.AGENTS.EDIT_AVATAR>;

type ImageData = {
    uri: string;
    name: string;
    type: string;
    file: File | CustomRNImageManipulatorResult | null;
};

const EMPTY_IMAGE_DATA: ImageData = {uri: '', name: '', type: '', file: null};

function EditAgentAvatarPage({route}: EditAgentAvatarPageProps) {
    const {translate} = useLocalize();
    const styles = useThemeStyles();
    const theme = useTheme();
    const icons = useMemoizedLazyExpensifyIcons(['Upload']);
    const accountID = route.params.accountID;

    const [personalDetails] = useOnyx(ONYXKEYS.PERSONAL_DETAILS_LIST, {selector: (list) => list?.[accountID]});

    const [selectedBotAvatar, setSelectedBotAvatar] = useState<BotAvatar | null>(null);
    const [imageData, setImageData] = useState<ImageData>(EMPTY_IMAGE_DATA);
    const [cropImageData, setCropImageData] = useState<ImageData>(EMPTY_IMAGE_DATA);
    const [isAvatarCropModalOpen, setIsAvatarCropModalOpen] = useState(false);
    const [errorData, setErrorData] = useState<{validationError: TranslationPaths | null; phraseParam: Record<string, unknown>}>({validationError: null, phraseParam: {}});

    const isSavingRef = useRef(false);
    const isDirty = selectedBotAvatar !== null || imageData.uri !== '';

    useDiscardChangesConfirmation({
        getHasUnsavedChanges: () => !isSavingRef.current && isDirty,
    });

    let previewSource: AvatarSource = personalDetails?.avatar ?? '';
    if (selectedBotAvatar) {
        previewSource = selectedBotAvatar;
    } else if (imageData.uri) {
        previewSource = imageData.uri;
    }

    const showAvatarCropModal = (image: FileObject) => {
        validateAvatarImage(image)
            .then((result) => {
                if (!result.isValid) {
                    setErrorData({validationError: result.errorKey ?? null, phraseParam: result.errorParams ?? {}});
                    return;
                }
                setIsAvatarCropModalOpen(true);
                setErrorData({validationError: null, phraseParam: {}});
                setCropImageData({
                    uri: image.uri ?? '',
                    name: image.name ?? '',
                    type: image.type ?? '',
                    file: null,
                });
            })
            .catch(() => {
                setErrorData({validationError: 'attachmentPicker.errorWhileSelectingCorruptedAttachment', phraseParam: {}});
            });
    };

    const onImageSelected = (file: File | CustomRNImageManipulatorResult) => {
        setSelectedBotAvatar(null);
        setImageData({
            uri: file?.uri ?? '',
            name: file?.name ?? '',
            file,
            type: '',
        });
        setIsAvatarCropModalOpen(false);
    };

    const handleSave = () => {
        if (!isDirty) {
            return;
        }
        isSavingRef.current = true;

        if (imageData.file) {
            updateAgentAvatar(accountID, {file: imageData.file, uri: imageData.uri}, personalDetails?.avatar);
            Navigation.goBack(ROUTES.SETTINGS_AGENTS_EDIT.getRoute(accountID));
            return;
        }

        if (selectedBotAvatar) {
            const customExpensifyAvatarID = botAvatarIDs.get(selectedBotAvatar);
            if (customExpensifyAvatarID) {
                updateAgentAvatar(accountID, {customExpensifyAvatarID}, personalDetails?.avatar);
                Navigation.goBack(ROUTES.SETTINGS_AGENTS_EDIT.getRoute(accountID));
            }
        }
    };

    return (
        <ScreenWrapper
            testID={EditAgentAvatarPage.displayName}
            includeSafeAreaPaddingBottom
            offlineIndicatorStyle={styles.mtAuto}
        >
            <HeaderWithBackButton
                title={translate('editAgentAvatarPage.title')}
                onBackButtonPress={() => Navigation.goBack(ROUTES.SETTINGS_AGENTS_EDIT.getRoute(accountID))}
            />
            <ScrollView
                style={styles.flex1}
                contentContainerStyle={styles.flexGrow1}
                keyboardShouldPersistTaps="handled"
            >
                <View style={[styles.flexColumn, styles.gap5, styles.alignItemsCenter, styles.pb10]}>
                    <Avatar
                        containerStyles={[styles.avatarXLarge, styles.alignSelfCenter]}
                        imageStyles={[styles.avatarXLarge, styles.alignSelfCenter]}
                        source={previewSource}
                        avatarID={accountID}
                        size={CONST.AVATAR_SIZE.X_LARGE}
                        type={CONST.ICON_TYPE_AVATAR}
                    />
                    <AttachmentPicker
                        type={CONST.ATTACHMENT_PICKER_TYPE.IMAGE}
                        shouldValidateImage={false}
                    >
                        {({openPicker}) => (
                            <Button
                                icon={icons.Upload}
                                text={translate('avatarPage.uploadPhoto')}
                                accessibilityLabel={translate('avatarPage.uploadPhoto')}
                                isDisabled={isAvatarCropModalOpen}
                                onPress={() => {
                                    openPicker({
                                        onPicked: (data) => showAvatarCropModal(data.at(0) ?? {}),
                                    });
                                }}
                            />
                        )}
                    </AttachmentPicker>
                </View>
                <View style={[styles.ph5, styles.pb5, styles.flexColumn, styles.gap3]}>
                    <Text style={[styles.sidebarLinkText, styles.optionAlternateText, styles.textLabelSupporting, styles.pre, styles.ph2]}>{translate('avatarPage.choosePresetAvatar')}</Text>
                    <View style={styles.avatarSelectorListContainer}>
                        {botAvatars.map((botAvatar) => {
                            const botAvatarID = botAvatarIDs.get(botAvatar);
                            const isSelected = selectedBotAvatar === botAvatar;
                            return (
                                <PressableWithFeedback
                                    key={botAvatarID}
                                    accessible
                                    accessibilityRole="button"
                                    accessibilityLabel={translate('avatarPage.selectAvatar')}
                                    onPress={() => {
                                        setSelectedBotAvatar(() => botAvatar);
                                        setImageData(EMPTY_IMAGE_DATA);
                                    }}
                                    style={[styles.avatarSelectorWrapper, isSelected && {borderColor: theme.success, borderWidth: 2}]}
                                >
                                    <Avatar
                                        type={CONST.ICON_TYPE_AVATAR}
                                        source={botAvatar}
                                        size={CONST.AVATAR_SIZE.MEDIUM}
                                        containerStyles={styles.avatarSelectorContainer}
                                    />
                                </PressableWithFeedback>
                            );
                        })}
                    </View>
                </View>
            </ScrollView>
            <FixedFooter style={styles.mtAuto}>
                {!!errorData.validationError && (
                    <DotIndicatorMessage
                        style={styles.mv5}
                        messages={{0: translate(errorData.validationError, errorData.phraseParam as never)}}
                        type="error"
                    />
                )}
                <Button
                    large
                    success
                    text={translate('common.save')}
                    isDisabled={!isDirty}
                    onPress={handleSave}
                    pressOnEnter
                />
            </FixedFooter>
            <AvatarCropModal
                onClose={() => {
                    if (!isAvatarCropModalOpen) {
                        return;
                    }
                    setCropImageData(EMPTY_IMAGE_DATA);
                    setIsAvatarCropModalOpen(false);
                }}
                isVisible={isAvatarCropModalOpen}
                onSave={onImageSelected}
                imageUri={cropImageData.uri}
                imageName={cropImageData.name}
                imageType={cropImageData.type}
                buttonLabel={translate('avatarPage.upload')}
            />
        </ScreenWrapper>
    );
}

EditAgentAvatarPage.displayName = 'EditAgentAvatarPage';

export default EditAgentAvatarPage;
