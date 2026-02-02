import { StyleSheet } from 'react-native';

// Visuals: this is the "CSS" for mobile app, handles presentation while HTML handles structure
export const styles = StyleSheet.create({
    // this organizes all styles into one object, better than a plain object because it provides autofill and catches errors
    container: { // main screen
        flex: 1, // tells view to expand and fill entire screen
        backgroundColor: '#ffffff', // light grey background
        alignItems: 'center', // centers all the children (labels, cards) horizontally 
        justifyContent: 'flex-start', // centers everything vertically
        paddingTop: 0, //manual centering for top portion
    },
    contentWrapper: {
        paddingHorizontal: 20, // Move the padding here
        alignItems: 'center',
        width: '100%',
        flex: 1,
    },
    card: {
        backgroundColor: '#ffffff', // pure white
        padding: 25, // space inside the box so text isn't touching box edges
        borderRadius: 20, // rounded corners
        width: '100%', // tells card to be as wide as possible (minus container's 20 unit padding)
        // shadows for a floating look
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5, // Android shadow
        marginBottom: 20
    },
    inputWrapper: {
        backgroundColor: 'lightgrey',
        padding: 15,
        borderRadius: 20,
        width: '60%',
        marginTop: 15,
        height: 50
    },
    friendBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 50,
        justifyContent: 'space-between',
        backgroundColor: '#f0f0f5',
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderRadius: 12,
        marginTop: 0,
        borderWidth: 1,
        borderColor: '#e5e5ea'
    },
    friendIdText: {
        fontSize: 15,
        color: '#3a3a3c',
        fontFamily: 'Courier'
    },
    colorContainer: {
        flexDirection: 'row',        // Lays circles out in a horizontal line
        flexWrap: 'wrap',
        justifyContent: 'center',    // Centers them horizontally
        marginVertical: 20,          // Adds space above and below the row
        gap: 15,                     // Adds space between the circles
    },
    colorCircle: {
        width: 45,                   // Size of the circle
        height: 45,
        borderRadius: 22.5,          // Makes it a perfect circle (half of width)
        borderColor: '#000',         // Black border for the "selected" look
    },
    button: {
        backgroundColor: '#007aff',  // Nice iOS-style blue
        paddingVertical: 15,
        paddingHorizontal: 40,
        borderRadius: 10,
        marginTop: 20,
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',               // White text on the blue button
        fontSize: 18,
        fontWeight: 'bold',
    },
    customHeader: {
        height: 110,
        backgroundColor: '#ffffff',
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        borderColor: '#c1bcbce8',
        paddingHorizontal: 15,
        paddingBottom: 0,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
    },
    absoluteHeaderTitle: {
        position: 'absolute',
        top: 60,
        left: 0,
        right: 0,
        height: 45,
        alignItems: 'center',
        justifyContent: 'center'
    },
    headerButton: {
        marginTop: 50, // Matches your layout
        height: 45,
        paddingHorizontal: 12,
        borderRadius: 15,
        borderWidth: 1,
        justifyContent: 'center',
        minWidth: 80, // Ensures it doesn't get too tiny
    },
    headerButtonText: {
        color: 'black',
        fontSize: 13,
        fontWeight: 'bold',
        lineHeight: 15, // Helps with the \n layout
    },
    headerTitleText: {
        fontFamily: 'Courier',
        fontWeight: 'bold',
    },
    
    // chat specific styles
    messageBubble: {
        padding: 10,
        borderRadius: 10,
        maxWidth: '80%',
        marginBottom: 10
    },
    myMessage: {
        backgroundColor: '#007aff' + '20',
        alignSelf: 'flex-end',
        borderBottomRightRadius: 0,
    },
    theirMessage: {
        backgroundColor: '#e5e5ea',
        alignSelf: 'flex-start',
        borderBottomLeftRadius: 0,
    },
    messageInputContainer: {
        flexDirection: 'row',
        paddingVertical: 10,
        paddingHorizontal: 10,
        backgroundColor: 'white',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    messageInput: {
        flex: 1,
        height: 40,
        borderColor: '#ddd',
        borderWidth: 1,
        borderRadius: 20,
        paddingHorizontal: 15,
        marginRight: 10,
        backgroundColor: '#fff',
        height: 45,
        fontSize: 18
    },
    sendButton: {
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 10,
        height: 40,
        backgroundColor: '#007aff',
        borderRadius: 20,
    },
    sidebarContainer: {
        backgroundColor: '#ffffff',
        width: '80%',
        height: '100%',
        alignSelf: 'flex-end', // Pushes sidebar to the right
        paddingTop: 50,
        paddingHorizontal: 20,
        backfaceVisibility: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: -5, height: 0 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 5,
    },
    sidebarHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        borderBottomWidth: 2,
        borderBottomColor: '#eee',
        paddingBottom: 10,
    },
    sidebarTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    userItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
    },
    userDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 10,
    },
    userName: {
        fontSize: 16,
        flex: 1,
    },
    // notifications
    notificationBar: {
        position: 'absolute',
        top: 10, // Below the notch/status bar
        left: 10,
        right: 10,
        backgroundColor: '#333',
        padding: 15,
        borderRadius: 10,
        elevation: 10, // Shadow for Android
        shadowColor: '#000', // Shadow for iOS
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        zIndex: 9999,
    },
    notificationTitle: { 
        color: '#fff', 
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    notificationText: { 
        color: '#ccc', 
        fontSize: 12 
    }
});